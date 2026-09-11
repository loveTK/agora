const express = require("express");
const { db } = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/authMiddleware");
const {
  getTotalPoints,
  getTopContributors,
  getResistancePoints,
  recordContribution,
  attemptAttack,
  RESISTANCE_THRESHOLD,
} = require("../services/neighborhoodConquest");
const { getSeasonProgress } = require("../services/neighborhoodSeason");

const router = express.Router();

// GET /neighborhoods/season/current — 시즌 카운트다운 오버레이용.
// "/season/current"라는 고정 경로라 아래 "/:id"보다 먼저 등록해야 :id로 잡아먹히지 않는다.
router.get("/season/current", (req, res) => {
  res.json(getSeasonProgress());
});

// GET /neighborhoods?region_id=<선택>
// 영토가 전 세계 수백 곳이라 행마다 getTotalPoints/getResistancePoints를 부르면 요청 한 번에
// 쿼리가 수천 번 나간다(better-sqlite3는 동기 실행이라 그대로 이벤트 루프를 막는다).
// 그래서 합산은 전부 집계 LEFT JOIN으로 한 방에 가져온다.
router.get("/", optionalAuth, (req, res) => {
  const { region_id } = req.query;
  const baseSelect = `
    SELECT n.*, r.name AS region_name, u.nickname AS dominant_nickname,
           COALESCE(c.total, 0) AS total_points,
           res.total AS my_resistance_points
    FROM neighborhoods n
    JOIN regions r ON r.id = n.parent_region_id
    LEFT JOIN users u ON u.id = n.dominant_user_id
    LEFT JOIN (
      SELECT neighborhood_id, SUM(points) AS total
      FROM neighborhood_contributions GROUP BY neighborhood_id
    ) c ON c.neighborhood_id = n.id
    LEFT JOIN (
      SELECT neighborhood_id, SUM(points) AS total
      FROM neighborhood_resistance WHERE user_id = ? GROUP BY neighborhood_id
    ) res ON res.neighborhood_id = n.id`;

  // 비로그인이면 어떤 user_id와도 안 맞는 값을 넣어 저항 포인트 서브쿼리가 통째로 비게 한다.
  const userId = req.userId || null;
  const rows = region_id
    ? db.prepare(`${baseSelect} WHERE n.parent_region_id = ? ORDER BY n.name`).all(userId, region_id)
    : db.prepare(`${baseSelect} ORDER BY r.name, n.name`).all(userId);

  const result = rows.map((n) => ({
    id: n.id,
    parent_region_id: n.parent_region_id,
    region_name: n.region_name,
    name: n.name,
    status: n.status,
    npc_difficulty: n.npc_difficulty,
    dominant_user_id: n.dominant_user_id,
    dominant_nickname: n.dominant_nickname,
    total_points: n.total_points,
    lat: n.lat,
    lng: n.lng,
    my_resistance_points: req.userId ? n.my_resistance_points || 0 : null,
  }));
  res.json(result);
});

// GET /neighborhoods/:id — 상세(기여도 상위 랭킹 + 인접 목록 포함)
router.get("/:id", optionalAuth, (req, res) => {
  const n = db
    .prepare(
      `SELECT n.*, r.name AS region_name, u.nickname AS dominant_nickname
       FROM neighborhoods n
       JOIN regions r ON r.id = n.parent_region_id
       LEFT JOIN users u ON u.id = n.dominant_user_id
       WHERE n.id = ?`
    )
    .get(req.params.id);
  if (!n) return res.status(404).json({ error: "동을 찾을 수 없습니다." });

  const adjacent = db
    .prepare(
      `SELECT adj.id, adj.name, adj.status, adj.dominant_user_id
       FROM neighborhood_adjacency na
       JOIN neighborhoods adj ON adj.id = na.adjacent_neighborhood_id
       WHERE na.neighborhood_id = ?
       ORDER BY adj.name`
    )
    .all(req.params.id);

  res.json({
    id: n.id,
    parent_region_id: n.parent_region_id,
    region_name: n.region_name,
    name: n.name,
    status: n.status,
    npc_difficulty: n.npc_difficulty,
    dominant_user_id: n.dominant_user_id,
    dominant_nickname: n.dominant_nickname,
    total_points: getTotalPoints(n.id),
    top_contributors: getTopContributors(n.id, 5),
    adjacent_neighborhoods: adjacent,
    my_resistance_points: req.userId ? getResistancePoints(n.id, req.userId) : null,
    resistance_threshold: RESISTANCE_THRESHOLD,
    lat: n.lat,
    lng: n.lng,
  });
});

// POST /neighborhoods/:id/contribute
// 로그인만 필요 — 클라이언트는 "기여했다"는 트리거만 보내고, 포인트 지급/해방 판정은 전부 서버가 한다.
router.post("/:id/contribute", requireAuth, (req, res) => {
  const result = recordContribution(req.params.id, req.userId, req.ip);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result);
});

// POST /neighborhoods/:id/attack
// body: { from_neighborhood_id }  — 반란(재탈환) 특별 공격권이 있으면 생략 가능(서버가 저항 포인트로 판단).
// 클라이언트가 보낸 승패 주장은 없다 — 결과는 이 응답이 곧 최종 판정이다.
router.post("/:id/attack", requireAuth, (req, res) => {
  const { from_neighborhood_id } = req.body || {};
  const result = attemptAttack(req.params.id, req.userId, from_neighborhood_id || null, req.ip);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(200).json(result);
});

module.exports = router;
