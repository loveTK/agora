const express = require("express");
const { db } = require("../db");

const router = express.Router();

// GET /hall-of-fame
// 역대 지배자 재위 기록(streak 긴 순) + 현재 선지자 랭킹(명성 높은 순)을 함께 보여준다.
router.get("/", (req, res) => {
  const topRulers = db
    .prepare(
      `SELECT dh.region_id, dh.user_id, dh.streak_days, dh.started_at, dh.ended_at, dh.ended_reason,
              u.nickname, r.name AS region_name
       FROM dominance_history dh
       JOIN users u ON u.id = dh.user_id
       JOIN regions r ON r.id = dh.region_id
       ORDER BY dh.streak_days DESC, dh.started_at ASC
       LIMIT 20`
    )
    .all();

  const topProphets = db
    .prepare(
      `SELECT u.id, u.nickname, u.reputation, r.name AS region_name
       FROM users u JOIN regions r ON r.id = u.region_id
       WHERE u.rank = 'prophet'
       ORDER BY u.reputation DESC
       LIMIT 20`
    )
    .all();

  res.json({ top_rulers: topRulers, top_prophets: topProphets });
});

module.exports = router;
