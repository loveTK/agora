const { db } = require("../db");

// 신규 계정 가중치 낮추기 (어뷰징 방지 합의사항).
// 판정투표(judgment_votes)는 "정족수 N명"이라는 headcount 개념이 핵심이라
// 가중치를 적용하지 않고 1인 1표를 유지한다. 가중치는 추천/비추천(votes)에만 적용한다.
function getVoteWeight(userId) {
  const user = db.prepare("SELECT created_at FROM users WHERE id = ?").get(userId);
  if (!user) return 1.0;

  const ageDays = (Date.now() - new Date(user.created_at + "Z").getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays < 3) return 0.3;
  if (ageDays < 7) return 0.6;
  return 1.0;
}

module.exports = { getVoteWeight };
