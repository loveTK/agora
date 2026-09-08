const { db } = require("../db");
const { belligerenceTier } = require("./belligerence");

function followerCount(userId) {
  return db.prepare("SELECT COUNT(*) AS count FROM follows WHERE followee_id = ?").get(userId).count;
}

// 프로필 모달 / 오늘의 Top 논객 카드에서 공용으로 쓰는 유저 요약 정보.
// 소속 지역·정당·종교·현재 지배 중인 지역까지 한 번에 묶어서 반환한다.
function getUserProfileSummary(userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return null;

  const region = db.prepare("SELECT id, name FROM regions WHERE id = ?").get(user.region_id);
  const party = db
    .prepare(
      `SELECT p.id, p.name FROM party_members pm JOIN parties p ON p.id = pm.party_id WHERE pm.user_id = ?`
    )
    .get(userId);
  const religion = db
    .prepare(
      `SELECT r.id, r.name FROM religion_members rm JOIN religions r ON r.id = rm.religion_id WHERE rm.user_id = ?`
    )
    .get(userId);
  const dominanceRegions = db
    .prepare(`SELECT r.id, r.name FROM dominance d JOIN regions r ON r.id = d.region_id WHERE d.user_id = ?`)
    .all(userId);

  return {
    id: user.id,
    nickname: user.nickname,
    region_id: user.region_id,
    region_name: region ? region.name : null,
    rank: user.rank,
    reputation: user.reputation,
    belligerence_tier: belligerenceTier(user.belligerence),
    follower_count: followerCount(userId),
    party: party || null,
    religion: religion || null,
    dominance_regions: dominanceRegions,
    created_at: user.created_at,
  };
}

module.exports = { getUserProfileSummary, followerCount };
