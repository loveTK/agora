const { randomUUID } = require("crypto");
const { db } = require("../db");
const { getVoteWeight } = require("./voteWeight");

// thread_votes와 동일한 성격 — 대댓글 추천/비추천도 순수 참여도 집계용이라 명성에는 영향 없음.
const DAILY_REPLY_VOTE_LIMIT = 100;

function getReplyVoteTally(replyId) {
  return db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN vote_type = 'up' THEN weight ELSE 0 END), 0) AS upvotes,
         COALESCE(SUM(CASE WHEN vote_type = 'down' THEN weight ELSE 0 END), 0) AS downvotes
       FROM reply_votes WHERE reply_id = ?`
    )
    .get(replyId);
}

function toggleReplyVote(userId, replyId, voteType) {
  if (!["up", "down"].includes(voteType)) {
    return { error: "vote_type은 'up' 또는 'down'이어야 합니다.", status: 400 };
  }

  const reply = db.prepare("SELECT author_id FROM argument_replies WHERE id = ?").get(replyId);
  if (!reply) return { error: "답글을 찾을 수 없습니다.", status: 404 };
  if (reply.author_id === userId) {
    return { error: "본인 답글에는 반응할 수 없습니다.", status: 403 };
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM reply_votes
       WHERE voter_id = ? AND date(created_at) = date('now')`
    )
    .get(userId).count;
  if (todayCount >= DAILY_REPLY_VOTE_LIMIT) {
    return { error: `답글 추천/비추천은 하루 ${DAILY_REPLY_VOTE_LIMIT}회까지만 가능합니다.`, status: 429 };
  }

  const existing = db
    .prepare("SELECT * FROM reply_votes WHERE reply_id = ? AND voter_id = ?")
    .get(replyId, userId);

  const tx = db.transaction(() => {
    if (!existing) {
      const weight = getVoteWeight(userId);
      db.prepare(
        "INSERT INTO reply_votes (id, reply_id, voter_id, vote_type, weight) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), replyId, userId, voteType, weight);
      return "cast";
    }
    if (existing.vote_type === voteType) {
      db.prepare("DELETE FROM reply_votes WHERE id = ?").run(existing.id);
      return "cancelled";
    }
    db.prepare("UPDATE reply_votes SET vote_type = ?, created_at = datetime('now') WHERE id = ?").run(
      voteType,
      existing.id
    );
    return "changed";
  });
  const result = tx();

  return { result, ...getReplyVoteTally(replyId) };
}

module.exports = { toggleReplyVote, getReplyVoteTally, DAILY_REPLY_VOTE_LIMIT };
