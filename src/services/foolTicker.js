const { randomUUID } = require("crypto");
const { db } = require("../db");

// 지도 게시물에 누적된 "바보" 반응 총합(가중치 합산)이 임계치를 넘으면 이그지니어스 티커를 준다.
// 논제/논증 쪽 기존 이그지니어스(웃기다 반응 합산, ingeniousTicker.js)와는 별개 경로지만
// 같은 티커를 발급한다 — source_type='user'로 구분해 한 번만 지급되게 한다.
const FOOL_SCORE_INGENIOUS_THRESHOLD = 50;
const TICKER_NAME = "ingenious";

function checkAndGrantFoolTicker(userId) {
  const user = db.prepare("SELECT fool_score FROM users WHERE id = ?").get(userId);
  if (!user || user.fool_score < FOOL_SCORE_INGENIOUS_THRESHOLD) return false;

  const already = db
    .prepare(
      "SELECT id FROM user_tickers WHERE user_id = ? AND ticker = ? AND source_type = ? AND source_id = ?"
    )
    .get(userId, TICKER_NAME, "user", userId);
  if (already) return false;

  db.prepare(
    "INSERT INTO user_tickers (id, user_id, ticker, source_type, source_id) VALUES (?, ?, ?, ?, ?)"
  ).run(randomUUID(), userId, TICKER_NAME, "user", userId);
  return true;
}

module.exports = { FOOL_SCORE_INGENIOUS_THRESHOLD, TICKER_NAME, checkAndGrantFoolTicker };
