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
              t.author_id, u.nickname AS author_nickname,
              (SELECT COUNT(*) FROM arguments a WHERE a.thread_id = t.id) AS argument_count,
              (SELECT COALESCE(SUM(a.upvotes), 0) FROM arguments a WHERE a.thread_id = t.id) AS total_upvotes,
              (SELECT COALESCE(SUM(CASE WHEN tv.vote_type = 'up' THEN tv.weight ELSE 0 END), 0)
                 FROM thread_votes tv WHERE tv.thread_id = t.id) AS thread_upvotes,
              (SELECT COALESCE(SUM(CASE WHEN tv.vote_type = 'down' THEN tv.weight ELSE 0 END), 0)
                 FROM thread_votes tv WHERE tv.thread_id = t.id) AS thread_downvotes,
              (SELECT COALESCE(SUM(lr.weight), 0) FROM laugh_reactions lr
                 WHERE lr.target_type = 'thread' AND lr.target_id = t.id) AS thread_laugh_count,
              -- 참여 = 논증을 쓴 사람 + 이 논제에 추천/비추천/바보 반응을 남긴 사람 (중복 제거)
              (SELECT COUNT(*) FROM (
                 SELECT author_id AS uid FROM arguments WHERE thread_id = t.id
                 UNION
                 SELECT voter_id AS uid FROM thread_votes WHERE thread_id = t.id
                 UNION
                 SELECT user_id AS uid FROM laugh_reactions WHERE target_type = 'thread' AND target_id = t.id
               )) AS participant_count
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
