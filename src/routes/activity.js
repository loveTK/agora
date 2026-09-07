const express = require("express");
const { db } = require("../db");

const router = express.Router();

// GET /activity/recent
// 히어로의 "실시간 활동" 피드용 — 실제로 방금 일어난 논제 등록/투표만 보여준다(가짜 이벤트 없음).
router.get("/recent", (req, res) => {
  const events = db
    .prepare(
      `SELECT 'thread_created' AS type, t.id AS thread_id, t.title AS thread_title,
              t.created_at AS created_at, u.nickname AS actor_nickname, r.name AS region_name
       FROM threads t
       JOIN users u ON u.id = t.author_id
       JOIN regions r ON r.id = t.region_id
       WHERE t.hidden = 0
       UNION ALL
       SELECT 'thread_voted' AS type, t.id AS thread_id, t.title AS thread_title,
              tv.created_at AS created_at, u.nickname AS actor_nickname, r.name AS region_name
       FROM thread_votes tv
       JOIN threads t ON t.id = tv.thread_id
       JOIN users u ON u.id = tv.voter_id
       JOIN regions r ON r.id = t.region_id
       WHERE t.hidden = 0
       ORDER BY created_at DESC
       LIMIT 8`
    )
    .all();
  res.json(events);
});

module.exports = router;
