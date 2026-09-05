const { db } = require("../db");

// 계급 임계값 (기획 합의사항: 시민 -> 지지자(supporter) -> 선지자, 선지자는 지역당 슬롯 제한)
// 계급명 "지지자"의 DB 내부 키는 팔로우 기능(follower)과 구분하기 위해 'supporter'로 둔다.
const SUPPORTER_THRESHOLD = 50;
const PROPHET_THRESHOLD = 200;
const PROPHET_SLOTS_PER_REGION = 3;

// 한 지역의 계급을 통째로 다시 계산한다. 명성이 바뀔 때마다 지역 단위로 호출한다.
function recalcRegionRanks(regionId) {
  const prophetSlotHolders = db
    .prepare(
      `SELECT id FROM users
       WHERE region_id = ? AND reputation >= ?
       ORDER BY reputation DESC, created_at ASC
       LIMIT ?`
    )
    .all(regionId, PROPHET_THRESHOLD, PROPHET_SLOTS_PER_REGION);
  const prophetIds = new Set(prophetSlotHolders.map((u) => u.id));

  const allUsersInRegion = db
    .prepare("SELECT id, reputation, rank FROM users WHERE region_id = ?")
    .all(regionId);

  for (const u of allUsersInRegion) {
    const newRank = prophetIds.has(u.id)
      ? "prophet"
      : u.reputation >= SUPPORTER_THRESHOLD
      ? "supporter"
      : "citizen";
    if (newRank !== u.rank) {
      db.prepare("UPDATE users SET rank = ? WHERE id = ?").run(newRank, u.id);
    }
  }
}

// 특정 유저의 명성이 바뀌었을 때 호출하는 편의 함수 (소속 지역을 조회해 지역 단위 재계산으로 위임)
function recalcRank(userId) {
  const user = db.prepare("SELECT region_id FROM users WHERE id = ?").get(userId);
  if (!user) return;
  recalcRegionRanks(user.region_id);
}

module.exports = {
  SUPPORTER_THRESHOLD,
  PROPHET_THRESHOLD,
  PROPHET_SLOTS_PER_REGION,
  recalcRank,
  recalcRegionRanks,
};
