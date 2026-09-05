const { db } = require("../db");

// 병력 환산: 그 지역 주민 전원의 팔로워 수 합계 (기획 합의사항).
function regionMilitaryPower(regionId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(fc.count), 0) AS power
       FROM users u
       LEFT JOIN (
         SELECT followee_id, COUNT(*) AS count FROM follows GROUP BY followee_id
       ) fc ON fc.followee_id = u.id
       WHERE u.region_id = ?`
    )
    .get(regionId);
  return row.power;
}

module.exports = { regionMilitaryPower };
