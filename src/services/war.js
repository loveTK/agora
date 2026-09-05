const { randomUUID } = require("crypto");
const { db } = require("../db");
const { regionMilitaryPower } = require("./military");

// 수치는 전부 기획 문서상 "예시"로 제시됐던 값이며, 정식 수치는 아직 미확정 상태다(문서 6.1/6.6절 참고).
const VOTE_QUORUM = 30;                 // 수락 투표 최소 참여 인원 (판정 시스템과 동일 기준 재사용)
const APPROVAL_RATIO = 0.5;             // 과반
const VOTE_WINDOW_HOURS = 24;           // 수락 투표 제한 시간
const DECLARE_COOLDOWN_DAYS = 7;        // 지배자당 선포 쿨다운 (주 1회)
const SAME_TARGET_COOLDOWN_DAYS = 14;   // 동일 상대 재선포 쿨다운
const MAX_POWER_RATIO = 3;              // 공격측 병력이 방어측의 이 배수를 넘으면 선포 불가(약소 지역 보호)
const AVOIDANCE_RULER_PENALTY = 50;     // 회피(부결) 시 방어측 지배자 명성 하락폭
const SUBMISSION_DAYS = 7;              // 회피 시 시민에게 부여되는 "굴복 상태" 지속 기간

// 이 지역의 현재 지배자가 명성을 얻을 수 있는 상태인지 확인한다.
// "굴복 상태"인 동안에는 지배자의 명성 획득(양수 델타)만 막는다 — 손실(비추천 등)은 그대로 반영.
function isReputationGainBlocked(userId) {
  const dominanceRow = db.prepare("SELECT region_id FROM dominance WHERE user_id = ?").get(userId);
  if (!dominanceRow) return false;
  const region = db.prepare("SELECT submission_until FROM regions WHERE id = ?").get(dominanceRow.region_id);
  return !!(region && region.submission_until && region.submission_until > new Date().toISOString());
}

function declareWar(attackerUserId, defenderRegionId) {
  const attackerDominance = db.prepare("SELECT * FROM dominance WHERE user_id = ?").get(attackerUserId);
  if (!attackerDominance) {
    return { error: "지배자만 전쟁을 선포할 수 있습니다.", status: 403 };
  }
  const attackerRegionId = attackerDominance.region_id;

  if (attackerRegionId === defenderRegionId) {
    return { error: "자신의 지역에는 선전포고할 수 없습니다.", status: 400 };
  }

  const defenderDominance = db.prepare("SELECT * FROM dominance WHERE region_id = ?").get(defenderRegionId);
  if (!defenderDominance) {
    return { error: "지배자가 없는 지역(무주공산)에는 선전포고할 수 없습니다.", status: 400 };
  }

  const recentAny = db
    .prepare(
      `SELECT id FROM wars WHERE attacker_region_id = ?
       AND created_at >= datetime('now', ?)`
    )
    .get(attackerRegionId, `-${DECLARE_COOLDOWN_DAYS} days`);
  if (recentAny) {
    return { error: `선전포고는 지배자당 ${DECLARE_COOLDOWN_DAYS}일에 한 번만 가능합니다.`, status: 429 };
  }

  const recentSameTarget = db
    .prepare(
      `SELECT id FROM wars WHERE attacker_region_id = ? AND defender_region_id = ?
       AND created_at >= datetime('now', ?)`
    )
    .get(attackerRegionId, defenderRegionId, `-${SAME_TARGET_COOLDOWN_DAYS} days`);
  if (recentSameTarget) {
    return {
      error: `동일 지역에는 ${SAME_TARGET_COOLDOWN_DAYS}일 이내 재선포할 수 없습니다.`,
      status: 429,
    };
  }

  const attackerPower = regionMilitaryPower(attackerRegionId);
  const defenderPower = regionMilitaryPower(defenderRegionId);
  // 방어측 병력이 0이어도(=가장 취약한 지역) 보호 대상에서 제외되면 안 되므로 조건 없이 비교한다.
  if (attackerPower > defenderPower * MAX_POWER_RATIO) {
    return {
      error: `병력 격차가 너무 큽니다(공격측 ${attackerPower} / 방어측 ${defenderPower}). 약소 지역 보호 정책에 따라 선포할 수 없습니다.`,
      status: 403,
    };
  }

  const id = randomUUID();
  const deadline = db
    .prepare("SELECT datetime('now', ?) AS d")
    .get(`+${VOTE_WINDOW_HOURS} hours`).d;

  db.prepare(
    `INSERT INTO wars (id, attacker_region_id, defender_region_id, declared_by, vote_deadline)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, attackerRegionId, defenderRegionId, attackerUserId, deadline);

  return {
    war: {
      id,
      attacker_region_id: attackerRegionId,
      defender_region_id: defenderRegionId,
      status: "voting",
      vote_deadline: deadline,
      attacker_power: attackerPower,
      defender_power: defenderPower,
    },
  };
}

function getWarTally(warId) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN verdict = 'accept' THEN 1 ELSE 0 END) AS accept_votes,
         SUM(CASE WHEN verdict = 'reject' THEN 1 ELSE 0 END) AS reject_votes,
         COUNT(*) AS participant_count
       FROM war_votes WHERE war_id = ?`
    )
    .get(warId);

  const accept_votes = row.accept_votes || 0;
  const reject_votes = row.reject_votes || 0;
  const participant_count = row.participant_count || 0;
  const accept_ratio = participant_count > 0 ? accept_votes / participant_count : 0;

  return {
    accept_votes,
    reject_votes,
    participant_count,
    accept_ratio,
    quorum_met: participant_count >= VOTE_QUORUM,
  };
}

// 정족수 도달 시 즉시 결과를 확정한다(판정 시스템과 동일한 패턴 — 데드라인은 정족수 미달 시의
// 안전장치 역할만 한다. settleExpiredWars 참고).
function resolveWarIfReady(warId) {
  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(warId);
  if (!war || war.status !== "voting") return null;

  const tally = getWarTally(warId);
  if (!tally.quorum_met) return null;

  if (tally.accept_ratio >= APPROVAL_RATIO) {
    db.prepare("UPDATE wars SET status = 'accepted', resolved_at = datetime('now') WHERE id = ?").run(warId);
    return { ...tally, status: "accepted" };
  }

  // 회피(부결): 방어측 지배자 명성 하락 + 방어측 지역에 굴복 상태 부여
  const tx = db.transaction(() => {
    db.prepare("UPDATE wars SET status = 'avoided', resolved_at = datetime('now') WHERE id = ?").run(warId);

    const defenderDominance = db
      .prepare("SELECT * FROM dominance WHERE region_id = ?")
      .get(war.defender_region_id);
    if (defenderDominance) {
      db.prepare("UPDATE users SET reputation = MAX(0, reputation - ?) WHERE id = ?").run(
        AVOIDANCE_RULER_PENALTY,
        defenderDominance.user_id
      );
    }

    const submissionUntil = db
      .prepare("SELECT datetime('now', ?) AS d")
      .get(`+${SUBMISSION_DAYS} days`).d;
    db.prepare("UPDATE regions SET submission_until = ? WHERE id = ?").run(
      submissionUntil,
      war.defender_region_id
    );
  });
  tx();

  return { ...tally, status: "avoided" };
}

// 배치(하루 1회 전제): 데드라인이 지났는데도 정족수를 못 채운 전쟁을 무효 처리한다.
// (패널티 없음 — 재선포 쿨다운만 정상적으로 다시 적용됨)
function settleExpiredWars() {
  const expired = db
    .prepare("SELECT id FROM wars WHERE status = 'voting' AND vote_deadline < datetime('now')")
    .all();
  for (const w of expired) {
    db.prepare("UPDATE wars SET status = 'void', resolved_at = datetime('now') WHERE id = ?").run(w.id);
  }
  return expired.length;
}

module.exports = {
  VOTE_QUORUM,
  APPROVAL_RATIO,
  VOTE_WINDOW_HOURS,
  DECLARE_COOLDOWN_DAYS,
  SAME_TARGET_COOLDOWN_DAYS,
  MAX_POWER_RATIO,
  AVOIDANCE_RULER_PENALTY,
  SUBMISSION_DAYS,
  isReputationGainBlocked,
  declareWar,
  getWarTally,
  resolveWarIfReady,
  settleExpiredWars,
};
