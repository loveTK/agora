const express = require("express");
const { db } = require("../db");
const { getUserProfileSummary } = require("../services/userProfile");

const router = express.Router();

// GET /activity/recent
// 히어로의 "실시간 활동" 피드용 — 실제로 방금 일어난 논제 등록/투표만 보여준다(가짜 이벤트 없음).
router.get("/recent", (req, res) => {
  const events = db
    .prepare(
      `SELECT 'thread_created' AS type, t.id AS thread_id, t.title AS thread_title,
              t.created_at AS created_at, u.id AS actor_id, u.nickname AS actor_nickname, r.name AS region_name
       FROM threads t
       JOIN users u ON u.id = t.author_id
       JOIN regions r ON r.id = t.region_id
       WHERE t.hidden = 0
       UNION ALL
       SELECT 'thread_voted' AS type, t.id AS thread_id, t.title AS thread_title,
              tv.created_at AS created_at, u.id AS actor_id, u.nickname AS actor_nickname, r.name AS region_name
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

// GET /activity/today-top
// "오늘의 Top 논객" — 오늘(UTC 기준) 논제 등록 + 논증 등록 + 추천/비추천/바보 반응을 가장 많이
// 한 유저 1명을 프로필 정보와 함께 반환한다. 오늘 활동이 아예 없으면 null.
router.get("/today-top", (req, res) => {
  const row = db
    .prepare(
      `SELECT user_id, SUM(cnt) AS activity_count FROM (
         SELECT author_id AS user_id, COUNT(*) AS cnt FROM threads
           WHERE hidden = 0 AND created_at::date = current_date GROUP BY author_id
         UNION ALL
         SELECT author_id AS user_id, COUNT(*) AS cnt FROM arguments
           WHERE created_at::date = current_date GROUP BY author_id
         UNION ALL
         SELECT voter_id AS user_id, COUNT(*) AS cnt FROM votes
           WHERE created_at::date = current_date GROUP BY voter_id
         UNION ALL
         SELECT voter_id AS user_id, COUNT(*) AS cnt FROM thread_votes
           WHERE created_at::date = current_date GROUP BY voter_id
         UNION ALL
         SELECT voter_id AS user_id, COUNT(*) AS cnt FROM reply_votes
           WHERE created_at::date = current_date GROUP BY voter_id
         UNION ALL
         SELECT user_id, COUNT(*) AS cnt FROM laugh_reactions
           WHERE created_at::date = current_date GROUP BY user_id
       ) combined
       GROUP BY user_id
       ORDER BY activity_count DESC
       LIMIT 1`
    )
    .get();

  if (!row) return res.json(null);

  const profile = getUserProfileSummary(row.user_id);
  if (!profile) return res.json(null);

  res.json({ ...profile, activity_count: row.activity_count });
});

module.exports = router;
