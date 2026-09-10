// AGORA V3(동단위 정복 MVP) 핵심 로직. 전부 서버에서 계산한다 — 클라이언트가 보낸 "인접하다",
// "내가 이겼다" 같은 주장은 절대 신뢰하지 않고, 매번 DB로 재검증/재계산한다.
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { checkNeighborhoodContributionBrigading } = require("./abuseDetection");

const CONTRIBUTION_POINTS = 10;        // "기여하기" 1회당 지급 포인트
const DAILY_CONTRIBUTION_LIMIT = 10;   // 유저당 하루 기여 횟수 한도
const DAILY_ATTACK_LIMIT = 3;          // 유저당 하루 공격 횟수 한도(성공/실패 모두 소진)
const ATTACK_POWER_WINDOW_DAYS = 7;    // 공격력에 반영하는 "최근 N일" 기여 윈도우
const RESISTANCE_POINTS_ON_LOSS = 20;  // 공격에 밀려난 기존 지배자에게 주는 저항 포인트
const RESISTANCE_THRESHOLD = 40;       // 이 이상 쌓이면 반란(재탈환) 특별 공격권 발생
const SEASON_WEEKS = 8;                // 시즌 주기(조정 쉽게 상수로 분리 — 기획 5절)

function getTotalPoints(neighborhoodId) {
  return db
    .prepare("SELECT COALESCE(SUM(points), 0) AS total FROM neighborhood_contributions WHERE neighborhood_id = ?")
    .get(neighborhoodId).total;
}

function getRecentPoints(neighborhoodId, days) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS total FROM neighborhood_contributions
       WHERE neighborhood_id = ? AND created_at >= datetime('now', '-' || ? || ' days')`
    )
    .get(neighborhoodId, days).total;
}

function getTopContributors(neighborhoodId, limit = 5) {
  return db
    .prepare(
      `SELECT c.user_id, u.nickname, SUM(c.points) AS total_points
       FROM neighborhood_contributions c JOIN users u ON u.id = c.user_id
       WHERE c.neighborhood_id = ?
       GROUP BY c.user_id
       ORDER BY total_points DESC
       LIMIT ?`
    )
    .all(neighborhoodId, limit);
}

function isAdjacent(neighborhoodId, otherId) {
  return !!db
    .prepare("SELECT 1 FROM neighborhood_adjacency WHERE neighborhood_id = ? AND adjacent_neighborhood_id = ?")
    .get(neighborhoodId, otherId);
}

function getResistancePoints(neighborhoodId, userId) {
  return db
    .prepare(
      "SELECT COALESCE(SUM(points), 0) AS total FROM neighborhood_resistance WHERE neighborhood_id = ? AND user_id = ?"
    )
    .get(neighborhoodId, userId).total;
}

// npc 상태인 동의 누적 기여가 난이도를 넘으면 최다 기여자를 지배자로 세우고 PvP 대상으로 전환한다.
function checkLiberation(neighborhood) {
  if (neighborhood.status !== "npc") return null;
  const total = getTotalPoints(neighborhood.id);
  if (total < neighborhood.npc_difficulty) return null;

  const topContributor = getTopContributors(neighborhood.id, 1)[0];
  if (!topContributor) return null;

  db.prepare("UPDATE neighborhoods SET status = 'contested', dominant_user_id = ? WHERE id = ?").run(
    topContributor.user_id,
    neighborhood.id
  );
  // 창립자 타이틀 — 최초 해방자. PK 충돌 시 무시되므로(OR IGNORE) 이 동에 대해 최초 1회만 영구 기록된다.
  db.prepare("INSERT OR IGNORE INTO neighborhood_founders (neighborhood_id, user_id) VALUES (?, ?)").run(
    neighborhood.id,
    topContributor.user_id
  );

  return { liberated: true, dominant_user_id: topContributor.user_id, dominant_nickname: topContributor.nickname };
}

// POST /neighborhoods/:id/contribute 로직.
function recordContribution(neighborhoodId, userId, ip) {
  const neighborhood = db.prepare("SELECT * FROM neighborhoods WHERE id = ?").get(neighborhoodId);
  if (!neighborhood) return { error: "동을 찾을 수 없습니다.", status: 404 };

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM neighborhood_contributions
       WHERE user_id = ? AND created_at >= datetime('now', '-1 day')`
    )
    .get(userId).count;
  if (todayCount >= DAILY_CONTRIBUTION_LIMIT) {
    return { error: `기여는 하루 ${DAILY_CONTRIBUTION_LIMIT}회까지만 가능합니다.`, status: 429 };
  }

  db.prepare(
    "INSERT INTO neighborhood_contributions (id, neighborhood_id, user_id, points, ip) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), neighborhoodId, userId, CONTRIBUTION_POINTS, ip || null);

  if (ip) checkNeighborhoodContributionBrigading(neighborhoodId, ip);

  const updated = db.prepare("SELECT * FROM neighborhoods WHERE id = ?").get(neighborhoodId);
  const liberation = checkLiberation(updated);

  return {
    points_awarded: CONTRIBUTION_POINTS,
    total_points: getTotalPoints(neighborhoodId),
    liberation,
  };
}

// POST /neighborhoods/:id/attack 로직.
// fromNeighborhoodId는 "여기서 공격을 시작한다"는 클라이언트의 주장일 뿐 — dominant_user_id와
// neighborhood_adjacency를 서버가 다시 조회해서 실제로 그런지 검증한다.
function attemptAttack(targetId, userId, fromNeighborhoodId, ip) {
  const target = db.prepare("SELECT * FROM neighborhoods WHERE id = ?").get(targetId);
  if (!target) return { error: "동을 찾을 수 없습니다.", status: 404 };
  if (target.status === "npc") {
    return { error: "NPC 상태인 동은 공격이 아니라 기여로 해방시켜야 합니다.", status: 409 };
  }
  if (target.dominant_user_id === userId) {
    return { error: "이미 본인이 지배 중인 동입니다.", status: 409 };
  }

  const todayAttacks = db
    .prepare(
      `SELECT COUNT(*) AS count FROM neighborhood_attacks
       WHERE attacker_id = ? AND created_at >= datetime('now', '-1 day')`
    )
    .get(userId).count;
  if (todayAttacks >= DAILY_ATTACK_LIMIT) {
    return { error: `공격은 하루 ${DAILY_ATTACK_LIMIT}회까지만 가능합니다.`, status: 429 };
  }

  const resistancePoints = getResistancePoints(targetId, userId);
  const isInsurrection = resistancePoints >= RESISTANCE_THRESHOLD;

  let attackPower;
  if (isInsurrection) {
    // 반란(재탈환) 특별 공격권 — 인접/지배 조건 없이, 쌓인 저항 포인트 자체가 공격력이 된다.
    attackPower = resistancePoints;
  } else {
    if (!fromNeighborhoodId) {
      return { error: "공격을 시작할 인접 동(from_neighborhood_id)을 지정해야 합니다.", status: 400 };
    }
    const attackerNeighborhood = db.prepare("SELECT * FROM neighborhoods WHERE id = ?").get(fromNeighborhoodId);
    if (!attackerNeighborhood) return { error: "공격 출발 동을 찾을 수 없습니다.", status: 404 };
    if (attackerNeighborhood.dominant_user_id !== userId) {
      return { error: "본인이 지배 중인 동에서만 공격을 시작할 수 있습니다.", status: 403 };
    }
    if (!isAdjacent(fromNeighborhoodId, targetId)) {
      return { error: "인접한 동이 아닙니다.", status: 403 };
    }
    attackPower = getRecentPoints(fromNeighborhoodId, ATTACK_POWER_WINDOW_DAYS);
  }

  const defensePower = getTotalPoints(targetId);
  const attackerWins = attackPower > defensePower; // 동률은 방어측 승리(기존 전쟁 시스템과 동일한 관례)
  const previousDominant = target.dominant_user_id;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO neighborhood_attacks
         (id, target_neighborhood_id, from_neighborhood_id, attacker_id, attacker_power, defense_power, won, insurrection, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      targetId,
      fromNeighborhoodId || null,
      userId,
      attackPower,
      defensePower,
      attackerWins ? 1 : 0,
      isInsurrection ? 1 : 0,
      ip || null
    );

    if (attackerWins) {
      db.prepare("UPDATE neighborhoods SET dominant_user_id = ? WHERE id = ?").run(userId, targetId);
      if (previousDominant) {
        db.prepare(
          "INSERT INTO neighborhood_resistance (id, neighborhood_id, user_id, points) VALUES (?, ?, ?, ?)"
        ).run(randomUUID(), targetId, previousDominant, RESISTANCE_POINTS_ON_LOSS);
      }
      if (isInsurrection) {
        // 반란 성공 — 이번에 쓴 만큼만 차감(음수 포인트 기록)해 소진시킨다. 그 사이 새로 쌓인 분은 보존.
        db.prepare(
          "INSERT INTO neighborhood_resistance (id, neighborhood_id, user_id, points) VALUES (?, ?, ?, ?)"
        ).run(randomUUID(), targetId, userId, -resistancePoints);
      }
    }
  });
  tx();

  return {
    attacker_power: attackPower,
    defense_power: defensePower,
    attacker_wins: attackerWins,
    insurrection: isInsurrection,
    new_dominant_user_id: attackerWins ? userId : target.dominant_user_id,
  };
}

module.exports = {
  CONTRIBUTION_POINTS,
  DAILY_CONTRIBUTION_LIMIT,
  DAILY_ATTACK_LIMIT,
  ATTACK_POWER_WINDOW_DAYS,
  RESISTANCE_POINTS_ON_LOSS,
  RESISTANCE_THRESHOLD,
  SEASON_WEEKS,
  getTotalPoints,
  getRecentPoints,
  getTopContributors,
  isAdjacent,
  getResistancePoints,
  checkLiberation,
  recordContribution,
  attemptAttack,
};
