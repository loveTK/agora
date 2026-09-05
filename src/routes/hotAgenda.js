const express = require("express");
const { db } = require("../db");

const router = express.Router();

// GET /hot-agenda
// 지역 소속과 무관하게 전체 논제를 참여도(추천 합 + 논증 수) 기준으로 노출한다.
// 폴리스 탐험(내 지역 논제만)과 구분되는 별도 대시보드.
router.get("/", (req, res) => {
  const threads = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.created_at, t.region_id, r.name AS region_name,
              u.nickname AS author_nickname,
              (SELECT COUNT(*) FROM arguments a WHERE a.thread_id = t.id) AS argument_count,
              (SELECT COALESCE(SUM(a.upvotes), 0) FROM arguments a WHERE a.thread_id = t.id) AS total_upvotes,
              (SELECT COUNT(DISTINCT a.author_id) FROM arguments a WHERE a.thread_id = t.id) AS participant_count
       FROM threads t
       JOIN users u ON u.id = t.author_id
       JOIN regions r ON r.id = t.region_id
       WHERE t.hidden = 0 AND t.status = 'active'
       ORDER BY total_upvotes DESC, argument_count DESC
       LIMIT 30`
    )
    .all();

  res.json(threads);
});

module.exports = router;
