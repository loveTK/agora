const { db } = require("../db");

// 폭군 판정 임계값 (기획 확정: 비추천 누적 + 신고 누적 임계치 동시 충족)
// 폭군은 '지배자'에 한해 적용되는 상태 전환이다(망토가 검정으로 바뀌는 연출이 지배자 전용이므로).
// 지배자가 아닌 일반 유저에게는 폭군 낙인을 찍지 않는다.
const TYRANT_DOWNVOTES_THRESHOLD = 100;
const TYRANT_ACTIONED_REPORTS_THRESHOLD = 3;

function countActionedReportsAgainst(userId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count FROM reports r
       WHERE r.status = 'actioned' AND (
         (r.target_type = 'thread' AND r.target_id IN (SELECT id FROM threads WHERE author_id = ?))
         OR
         (r.target_type = 'argument' AND r.target_id IN (SELECT id FROM arguments WHERE author_id = ?))
       )`
    )
    .get(userId, userId).count;
}

// 이 유저가 현재 지배자라면, 비추천/신고 누적에 따라 ruler <-> tyrant 상태를 갱신한다.
// 회복(비추천이 줄거나 신고가 기각됨)하면 다시 ruler로 되돌아갈 수 있다.
function refreshTyrantStatus(userId) {
  const dominanceRow = db.prepare("SELECT * FROM dominance WHERE user_id = ?").get(userId);
  if (!dominanceRow) return null; // 지배자가 아니면 폭군 판정 대상 아님

  const user = db.prepare("SELECT downvotes_received FROM users WHERE id = ?").get(userId);
  const actionedReports = countActionedReportsAgainst(userId);

  const shouldBeTyrant =
    user.downvotes_received >= TYRANT_DOWNVOTES_THRESHOLD &&
    actionedReports >= TYRANT_ACTIONED_REPORTS_THRESHOLD;

  const newStatus = shouldBeTyrant ? "tyrant" : "ruler";
  if (newStatus !== dominanceRow.status) {
    db.prepare("UPDATE dominance SET status = ? WHERE id = ?").run(newStatus, dominanceRow.id);
  }
  return newStatus;
}

module.exports = {
  TYRANT_DOWNVOTES_THRESHOLD,
  TYRANT_ACTIONED_REPORTS_THRESHOLD,
  refreshTyrantStatus,
};
