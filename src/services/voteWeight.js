const { db } = require("../db");

// 신규 계정 가중치 낮추기(어뷰징 방지) — 서버 집계(명성/랭크/티커 임계값 등)에만 적용한다.
// 프론트엔드는 이 값을 그대로 보여주지 않고 클릭할 때마다 항상 +1로 보이게 따로 처리한다.
const NEW_ACCOUNT_WEIGHT = 0.1;
const NEW_ACCOUNT_DAYS = 7;

function getVoteWeight(userId) {
  const user = db.prepare("SELECT created_at FROM users WHERE id = ?").get(userId);
  if (!user) return 1.0;

  const ageDays = (Date.now() - new Date(user.created_at + "Z").getTime()) / (1000 * 60 * 60 * 24);
  return ageDays < NEW_ACCOUNT_DAYS ? NEW_ACCOUNT_WEIGHT : 1.0;
}

module.exports = { getVoteWeight };
