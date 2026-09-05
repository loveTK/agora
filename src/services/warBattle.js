const { randomUUID } = require("crypto");
const { db } = require("../db");

const BATTLE_WINDOW_HOURS = 48;      // 전투 논쟁 마감 시간
const OCCUPATION_DAYS = 7;           // 점령 상태 지속 기간
const THREAD_BAN_DAYS = 3;           // 점령 중 신규 논제 등록 제한 (occupied보다 짧게)
const RULER_VICTORY_BONUS = 200;     // 승리측 지배자 명성 보너스
const PARTICIPANT_VICTORY_BONUS = 5; // 승리 진영에서 논증을 실제로 작성한 유저 1인당 보너스 (투표만으로는 없음 — 무임승차 방지)

function isWarParticipant(userId, war) {
  const user = db.prepare("SELECT region_id FROM users WHERE id = ?").get(userId);
  return !!user && (user.region_id === war.attacker_region_id || user.region_id === war.defender_region_id);
}

function createBattle(war, founderUserId, { title, option_attacker, option_defender }) {
  if (war.declared_by !== founderUserId) {
    return { error: "선포자(공격측 지배자)만 전투를 개시할 수 있습니다.", status: 403 };
  }
  if (war.status !== "accepted") {
    return { error: "수락된 전쟁에서만 전투를 개시할 수 있습니다.", status: 409 };
  }
  const existing = db.prepare("SELECT id FROM war_battles WHERE war_id = ?").get(war.id);
  if (existing) {
    return { error: "이미 이 전쟁에 전투가 개설되어 있습니다.", status: 409 };
  }
  if (!title || !option_attacker || !option_defender) {
    return { error: "title, option_attacker, option_defender는 필수입니다.", status: 400 };
  }

  const id = randomUUID();
  const deadline = db.prepare("SELECT datetime('now', ?) AS d").get(`+${BATTLE_WINDOW_HOURS} hours`).d;
  db.prepare(
    `INSERT INTO war_battles (id, war_id, title, option_attacker, option_defender, deadline)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, war.id, title, option_attacker, option_defender, deadline);

  return { battle: db.prepare("SELECT * FROM war_battles WHERE id = ?").get(id) };
}

function getBattleTally(battleId) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN side = 'attacker' THEN upvotes ELSE 0 END) AS attacker_upvotes,
         SUM(CASE WHEN side = 'defender' THEN upvotes ELSE 0 END) AS defender_upvotes,
         SUM(CASE WHEN side = 'attacker' THEN 1 ELSE 0 END) AS attacker_arg_count,
         SUM(CASE WHEN side = 'defender' THEN 1 ELSE 0 END) AS defender_arg_count
       FROM war_battle_arguments WHERE battle_id = ?`
    )
    .get(battleId);
  return {
    attacker_upvotes: row.attacker_upvotes || 0,
    defender_upvotes: row.defender_upvotes || 0,
    attacker_arg_count: row.attacker_arg_count || 0,
    defender_arg_count: row.defender_arg_count || 0,
  };
}

// 승리측이 패배측 지역을 "점령"한다. 실제 인구 이동 없이, 패배 지역에 페널티(점령 상태)를
// 부여하는 방식으로 구현했다 — 문서 6.2절 "점령 상태" 정의와 일치.
function applyAbsorptionAndIncentives(war, battle, winnerSide) {
  const winnerRegionId = winnerSide === "attacker" ? war.attacker_region_id : war.defender_region_id;
  const loserRegionId = winnerSide === "attacker" ? war.defender_region_id : war.attacker_region_id;

  const tx = db.transaction(() => {
    // 패배 지역: 점령 상태 부여
    const occupiedUntil = db.prepare("SELECT datetime('now', ?) AS d").get(`+${OCCUPATION_DAYS} days`).d;
    const threadBanUntil = db.prepare("SELECT datetime('now', ?) AS d").get(`+${THREAD_BAN_DAYS} days`).d;
    db.prepare("UPDATE regions SET occupied_until = ?, thread_ban_until = ? WHERE id = ?").run(
      occupiedUntil,
      threadBanUntil,
      loserRegionId
    );

    // 패배 지역에 지배자가 있었다면 실각 처리 (처형과 유사하게 계급·명성 초기화, 지위 반납)
    const loserDominance = db.prepare("SELECT * FROM dominance WHERE region_id = ?").get(loserRegionId);
    if (loserDominance) {
      db.prepare(
        `UPDATE dominance_history SET ended_at = datetime('now'), ended_reason = 'conquered'
         WHERE region_id = ? AND user_id = ? AND ended_at IS NULL`
      ).run(loserRegionId, loserDominance.user_id);
      db.prepare("DELETE FROM dominance WHERE id = ?").run(loserDominance.id);
      db.prepare("UPDATE users SET rank = 'citizen', reputation = 0 WHERE id = ?").run(loserDominance.user_id);
      db.prepare("UPDATE regions SET status = 'dispute' WHERE id = ?").run(loserRegionId);
    }

    // 승리측 지배자 보너스
    const winnerDominance = db.prepare("SELECT * FROM dominance WHERE region_id = ?").get(winnerRegionId);
    if (winnerDominance) {
      db.prepare("UPDATE users SET reputation = reputation + ? WHERE id = ?").run(
        RULER_VICTORY_BONUS,
        winnerDominance.user_id
      );
    }

    // 승리 진영에서 논증을 실제로 작성한 유저에게만 보너스 (투표만 한 사람은 제외 — 무임승차 방지)
    const winningArguers = db
      .prepare("SELECT DISTINCT author_id FROM war_battle_arguments WHERE battle_id = ? AND side = ?")
      .all(battle.id, winnerSide);
    for (const row of winningArguers) {
      db.prepare("UPDATE users SET reputation = reputation + ? WHERE id = ?").run(
        PARTICIPANT_VICTORY_BONUS,
        row.author_id
      );
    }
  });
  tx();

  return { winner_region_id: winnerRegionId, loser_region_id: loserRegionId };
}

// 전투를 확정한다(마감 시각과 무관하게 즉시 확정 — 배치/관리자 호출용).
// 추천수 총합이 더 높은 진영이 승리. 동점이면 방어측 승리로 처리(선포자에게 유리하게
// 쏠리지 않도록 하는 임의의 타이브레이크 — 정식 규칙은 미확정).
function resolveBattle(battleId) {
  const battle = db.prepare("SELECT * FROM war_battles WHERE id = ?").get(battleId);
  if (!battle || battle.status !== "open") return null;

  const tally = getBattleTally(battleId);
  const winnerSide = tally.attacker_upvotes > tally.defender_upvotes ? "attacker" : "defender";

  db.prepare(
    "UPDATE war_battles SET status = 'settled', winner_side = ?, settled_at = datetime('now') WHERE id = ?"
  ).run(winnerSide, battleId);

  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(battle.war_id);
  const absorption = applyAbsorptionAndIncentives(war, battle, winnerSide);

  return { battle_id: battleId, winner_side: winnerSide, ...tally, ...absorption };
}

function settleDueBattles() {
  const due = db
    .prepare("SELECT id FROM war_battles WHERE status = 'open' AND deadline < datetime('now')")
    .all();
  const results = [];
  for (const b of due) {
    const result = resolveBattle(b.id);
    if (result) results.push(result);
  }
  return results;
}

module.exports = {
  BATTLE_WINDOW_HOURS,
  OCCUPATION_DAYS,
  THREAD_BAN_DAYS,
  RULER_VICTORY_BONUS,
  PARTICIPANT_VICTORY_BONUS,
  isWarParticipant,
  createBattle,
  getBattleTally,
  resolveBattle,
  settleDueBattles,
};
