const { randomUUID } = require("crypto");
const { db } = require("../db");

const INFLUENCE_THRESHOLD = 50;  // 이 이상이면 그 지역이 "사상 영향권"으로 인정됨
const CULTURE_ROUTE_THRESHOLD = 5; // 사상 영향권 지역 5곳 도달 시 문화 승리

// 타 지역에서의 활동(추천/비추천)을 영향력으로 반영한다. 본인 소속 지역은 대상 아님
// (자국 활동은 이미 명성/호전성으로 보상되므로 영향력은 순수하게 "타지 진출"만 측정).
function applyInfluenceDelta(userId, regionId, delta) {
  const user = db.prepare("SELECT region_id FROM users WHERE id = ?").get(userId);
  if (!user || user.region_id === regionId) return; // 자기 지역은 영향력 대상 아님

  const existing = db
    .prepare("SELECT * FROM influence WHERE user_id = ? AND region_id = ?")
    .get(userId, regionId);

  if (!existing) {
    db.prepare("INSERT INTO influence (id, user_id, region_id, points) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      userId,
      regionId,
      Math.max(0, delta)
    );
  } else {
    const newPoints = Math.max(0, existing.points + delta);
    db.prepare("UPDATE influence SET points = ? WHERE id = ?").run(newPoints, existing.id);
  }

  checkCulturalZoneAndVictory(userId, regionId);
}

// 영향력이 임계치를 새로 넘겼는지 확인하고, 넘겼다면 사상 영향권으로 등록.
// 이후 사상 영향권 지역이 5곳에 도달하면 문화 승리를 기록한다(1인 1회).
function checkCulturalZoneAndVictory(userId, regionId) {
  const row = db.prepare("SELECT points FROM influence WHERE user_id = ? AND region_id = ?").get(userId, regionId);
  if (!row || row.points < INFLUENCE_THRESHOLD) return;

  const alreadyZone = db
    .prepare("SELECT id FROM cultural_influence_zones WHERE user_id = ? AND foreign_region_id = ?")
    .get(userId, regionId);
  if (!alreadyZone) {
    db.prepare(
      "INSERT INTO cultural_influence_zones (id, user_id, foreign_region_id) VALUES (?, ?, ?)"
    ).run(randomUUID(), userId, regionId);
  }

  const zoneCount = db
    .prepare("SELECT COUNT(*) AS count FROM cultural_influence_zones WHERE user_id = ?")
    .get(userId).count;

  if (zoneCount >= CULTURE_ROUTE_THRESHOLD) {
    const alreadyVictory = db.prepare("SELECT id FROM culture_victories WHERE user_id = ?").get(userId);
    if (!alreadyVictory) {
      const user = db.prepare("SELECT region_id FROM users WHERE id = ?").get(userId);
      db.prepare(
        "INSERT INTO culture_victories (id, user_id, home_region_id) VALUES (?, ?, ?)"
      ).run(randomUUID(), userId, user.region_id);
    }
  }
}

module.exports = {
  INFLUENCE_THRESHOLD,
  CULTURE_ROUTE_THRESHOLD,
  applyInfluenceDelta,
};
