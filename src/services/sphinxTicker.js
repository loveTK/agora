const { randomUUID } = require("crypto");
const { db } = require("../db");

// 스핑크스 티커 — 이그지니어스(웃기다 반응 합산 임계값)의 대구: "좋은 질문을 던져 많은 참여를
// 이끌어낸 발의자"에게 자동 발급한다. 논제의 참여자 수(hotAgenda.js/threads.js와 동일 정의)가
// 임계값을 넘으면 그 논제의 작성자에게 1회만 발급된다.
const SPHINX_PARTICIPANT_THRESHOLD = 30;
const TICKER_NAME = "sphinx";

function checkAndGrantSphinxTicker(threadId) {
  const thread = db.prepare("SELECT author_id FROM threads WHERE id = ?").get(threadId);
  if (!thread) return false;

  const participantCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM (
         SELECT author_id AS uid FROM arguments WHERE thread_id = ?
         UNION
         SELECT voter_id AS uid FROM thread_votes WHERE thread_id = ?
         UNION
         SELECT user_id AS uid FROM laugh_reactions WHERE target_type = 'thread' AND target_id = ?
       )`
    )
    .get(threadId, threadId, threadId).count;

  if (participantCount < SPHINX_PARTICIPANT_THRESHOLD) return false;

  const already = db
    .prepare(
      "SELECT id FROM user_tickers WHERE user_id = ? AND ticker = ? AND source_type = ? AND source_id = ?"
    )
    .get(thread.author_id, TICKER_NAME, "thread", threadId);
  if (already) return false;

  db.prepare(
    "INSERT INTO user_tickers (id, user_id, ticker, source_type, source_id) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), thread.author_id, TICKER_NAME, "thread", threadId);
  return true;
}

module.exports = { SPHINX_PARTICIPANT_THRESHOLD, TICKER_NAME, checkAndGrantSphinxTicker };
