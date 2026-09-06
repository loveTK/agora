const { randomUUID } = require("crypto");
const { db } = require("../db");

// 19장 티커 도감: "이그지니어스" — 누구도 묻지 않은 질문에 답을 내놓은 자.
// 원래 기획은 관리자 수동 부여지만, 여기서는 "웃기다" 반응이 누적되면 자동 발급되는
// 보조 지표(커뮤니티 반응 기반 자동화)로 구현한다. 임계값은 조정 가능하도록 상수로 뺀다.
const INGENIOUS_LAUGH_THRESHOLD = 50;
const TICKER_NAME = "ingenious";

function authorOf(targetType, targetId) {
  const table = targetType === "thread" ? "threads" : "arguments";
  const row = db.prepare(`SELECT author_id FROM ${table} WHERE id = ?`).get(targetId);
  return row ? row.author_id : null;
}

// 웃기다 반응이 새로 하나 달릴 때마다 호출한다. 임계값 도달 시 작성자에게 티커를 1회만 발급한다
// (UNIQUE(user_id, ticker, source_type, source_id)라 중복 호출해도 안전).
function checkAndGrantIngeniousTicker(targetType, targetId) {
  const totalWeight = db
    .prepare("SELECT COALESCE(SUM(weight), 0) AS total FROM laugh_reactions WHERE target_type = ? AND target_id = ?")
    .get(targetType, targetId).total;

  if (totalWeight < INGENIOUS_LAUGH_THRESHOLD) return false;

  const authorId = authorOf(targetType, targetId);
  if (!authorId) return false;

  const already = db
    .prepare(
      "SELECT id FROM user_tickers WHERE user_id = ? AND ticker = ? AND source_type = ? AND source_id = ?"
    )
    .get(authorId, TICKER_NAME, targetType, targetId);
  if (already) return false;

  db.prepare(
    "INSERT INTO user_tickers (id, user_id, ticker, source_type, source_id) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), authorId, TICKER_NAME, targetType, targetId);
  return true;
}

module.exports = { INGENIOUS_LAUGH_THRESHOLD, TICKER_NAME, checkAndGrantIngeniousTicker };
