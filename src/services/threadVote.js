const { randomUUID } = require("crypto");
const { db } = require("../db");
const { getVoteWeight } = require("./voteWeight");

// Hot Issue 카드에서 바로 누르는 논제 단위 추천/비추천 — 순수 참여도 집계용(명성/계급에 영향 없음).
// 개별 논증 추천/비추천(votes 테이블, POST /arguments/:id/vote)과는 별개 트랙이다.
const DAILY_THREAD_VOTE_LIMIT = 100;

function getThreadVoteTally(threadId) {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN vote_type = 'up' THEN weight ELSE 0 END), 0) AS upvotes,
         COALESCE(SUM(CASE WHEN vote_type = 'down' THEN weight ELSE 0 END), 0) AS downvotes
       FROM thread_votes WHERE thread_id = ?`
    )
    .get(threadId);
  return row;
}

// 토글 + 전환: 같은 타입 재클릭 시 취소, 다른 타입 클릭 시 전환(추천/비추천은 동시에 못 가짐).
function toggleThreadVote(userId, threadId, voteType) {
  if (!["up", "down"].includes(voteType)) {
    return { error: "vote_type은 'up' 또는 'down'이어야 합니다.", status: 400 };
  }

  const thread = db.prepare("SELECT author_id FROM threads WHERE id = ?").get(threadId);
  if (!thread) return { error: "논제를 찾을 수 없습니다.", status: 404 };
  if (thread.author_id === userId) {
    return { error: "본인 논제에는 반응할 수 없습니다.", status: 403 };
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM thread_votes
       WHERE voter_id = ? AND date(created_at) = date('now')`
    )
    .get(userId).count;
  if (todayCount >= DAILY_THREAD_VOTE_LIMIT) {
    return { error: `논제 추천/비추천은 하루 ${DAILY_THREAD_VOTE_LIMIT}회까지만 가능합니다.`, status: 429 };
  }

  const existing = db
    .prepare("SELECT * FROM thread_votes WHERE thread_id = ? AND voter_id = ?")
    .get(threadId, userId);

  const tx = db.transaction(() => {
    if (!existing) {
      const weight = getVoteWeight(userId);
      db.prepare(
        "INSERT INTO thread_votes (id, thread_id, voter_id, vote_type, weight) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), threadId, userId, voteType, weight);
      return "cast";
    }
    if (existing.vote_type === voteType) {
      db.prepare("DELETE FROM thread_votes WHERE id = ?").run(existing.id);
      return "cancelled";
    }
    db.prepare("UPDATE thread_votes SET vote_type = ?, created_at = datetime('now') WHERE id = ?").run(
      voteType,
      existing.id
    );
    return "changed";
  });
  const result = tx();

  return { result, ...getThreadVoteTally(threadId) };
}

module.exports = { toggleThreadVote, getThreadVoteTally, DAILY_THREAD_VOTE_LIMIT };
