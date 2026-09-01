const express = require("express");
const { db } = require("../db");

const router = express.Router();

// GET /regions
// 지도 렌더링용 경량 목록 (상태값만)
router.get("/", (req, res) => {
  const regions = db
    .prepare("SELECT id, name, status, lat, lng FROM regions ORDER BY name")
    .all();
  res.json(regions);
});

// GET /regions/:id
router.get("/:id", (req, res) => {
  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const population = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE region_id = ?")
    .get(req.params.id).count;

  res.json({ ...region, population });
});

// GET /regions/:id/threads
// 해당 지역의 논제 목록 (최신순)
router.get("/:id/threads", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const threads = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.created_at, u.nickname AS author_nickname,
              (SELECT COUNT(*) FROM arguments a WHERE a.thread_id = t.id) AS argument_count
       FROM threads t JOIN users u ON u.id = t.author_id
       WHERE t.region_id = ? AND t.hidden = 0
       ORDER BY t.created_at DESC`
    )
    .all(req.params.id);

  res.json(threads);
});

module.exports = router;
