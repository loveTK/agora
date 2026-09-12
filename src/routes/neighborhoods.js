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

const LEAF_LIMIT = 1500;      // bbox 조회 상한 — 이보다 넓으면 클라이언트가 묶음 레벨로 올라가야 한다
const CLUSTER_TTL_MS = 15000; // 묶음 집계 캐시. 유저별 값(내 영토 수)은 캐시 밖에서 따로 얹는다
const HOT_THRESHOLD = 6;      // 24시간 활동 점수가 이 이상이면 🔥

// GET /neighborhoods/season/current — 시즌 카운트다운 오버레이용.
// 고정 경로들은 아래 "/:id"보다 먼저 등록해야 :id로 잡아먹히지 않는다.
router.get("/season/current", (req, res) => {
  res.json(getSeasonProgress());
});

// ---------- 묶음(클러스터) 집계 ----------
// 영토가 수천 곳이라 지도는 줌에 따라 국가 묶음 → 광역 묶음 → 개별 구로 펼친다. 묶음 하나에
// 상태별 개수(미개척/타 세력/내 영토), 기록·댓글 수, 최근 24시간 활동 점수를 실어 보낸다.
let clusterCache = { at: 0, rows: null };

function countBy(sql) {
  const out = {};
  for (const r of db.prepare(sql).all()) out[r.pid] = r.c;
  return out;
}

function baseProvinceRows() {
  if (clusterCache.rows && Date.now() - clusterCache.at < CLUSTER_TTL_MS) return clusterCache.rows;

  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.lat, p.lng, p.region_id, r.name AS region_name, r.lat AS region_lat, r.lng AS region_lng,
              COUNT(n.id) AS total,
              SUM(CASE WHEN n.status = 'npc' THEN 1 ELSE 0 END) AS npc,
              COALESCE(mp.posts, 0) AS posts,
              COALESCE(mc.comments, 0) AS comments
       FROM provinces p
       JOIN regions r ON r.id = p.region_id
       LEFT JOIN neighborhoods n ON n.province_id = p.id
       LEFT JOIN (SELECT province_id, COUNT(*) AS posts FROM map_posts GROUP BY province_id) mp ON mp.province_id = p.id
       LEFT JOIN (
         SELECT x.province_id, COUNT(*) AS comments
         FROM map_post_comments c JOIN map_posts x ON x.id = c.post_id GROUP BY x.province_id
       ) mc ON mc.province_id = p.id
       GROUP BY p.id, r.id, mp.posts, mc.comments`
    )
    .all();

  // 최근 24시간 활동은 created_at 인덱스로 최근 행만 훑은 뒤 광역별로 묶는다(광역마다 서브쿼리를 돌리지 않는다).
  const contrib = countBy(
    `SELECT x.province_id AS pid, COUNT(*) AS c FROM neighborhood_contributions c
     JOIN neighborhoods x ON x.id = c.neighborhood_id
     WHERE c.created_at >= (now() + interval '-1 day') GROUP BY x.province_id`
  );
  const attacks = countBy(
    `SELECT x.province_id AS pid, COUNT(*) AS c FROM neighborhood_attacks a
     JOIN neighborhoods x ON x.id = a.target_neighborhood_id
     WHERE a.created_at >= (now() + interval '-1 day') GROUP BY x.province_id`
  );
  const posts = countBy(
    `SELECT province_id AS pid, COUNT(*) AS c FROM map_posts
     WHERE created_at >= (now() + interval '-1 day') GROUP BY province_id`
  );
  const comments = countBy(
    `SELECT x.province_id AS pid, COUNT(*) AS c FROM map_post_comments c
     JOIN map_posts x ON x.id = c.post_id
     WHERE c.created_at >= (now() + interval '-1 day') GROUP BY x.province_id`
  );
  for (const r of rows) {
    // 공격은 판이 뒤집히는 사건이라 가중치를 높게, 기록은 사람이 모이는 신호라 기여보다 조금 높게.
    r.heat = (contrib[r.id] || 0) + 3 * (attacks[r.id] || 0) + 2 * (posts[r.id] || 0) + (comments[r.id] || 0);
  }

  clusterCache = { at: Date.now(), rows };
  return rows;
}

function inBbox(bbox) {
  if (!bbox) return () => true;
  const [s, w, n, e] = String(bbox).split(",").map(Number);
  if ([s, w, n, e].some((v) => Number.isNaN(v))) return () => true;
  return (p) => p.lat >= s && p.lat <= n && (w <= e ? p.lng >= w && p.lng <= e : p.lng >= w || p.lng <= e);
}

// GET /neighborhoods/clusters?level=region|province[&bbox=s,w,n,e]
// 광역 묶음은 1,200곳이 넘어 전부 보내면 300KB가 넘는다. 화면 범위(bbox)로 잘라 보낸다.
router.get("/clusters", optionalAuth, (req, res) => {
  const level = req.query.level === "region" ? "region" : "province";
  const visible = inBbox(req.query.bbox);
  const mine = {};
  if (req.userId) {
    for (const r of db
      .prepare("SELECT province_id AS pid, COUNT(*) AS c FROM neighborhoods WHERE dominant_user_id = ? GROUP BY province_id")
      .all(req.userId)) mine[r.pid] = r.c;
  }

  const provinces = baseProvinceRows().map((r) => ({
    id: r.id,
    name: r.name,
    region_id: r.region_id,
    region_name: r.region_name,
    lat: r.lat,
    lng: r.lng,
    total: r.total,
    npc: r.npc,
    mine: mine[r.id] || 0,
    taken: r.total - r.npc - (mine[r.id] || 0),
    posts: r.posts,
    comments: r.comments,
    heat: r.heat,
    hot: r.heat >= HOT_THRESHOLD,
    _rlat: r.region_lat,
    _rlng: r.region_lng,
  }));

  if (level === "province") {
    return res.json(provinces.filter(visible).map(({ _rlat, _rlng, region_id, ...p }) => p));
  }

  const byRegion = new Map();
  for (const p of provinces) {
    let g = byRegion.get(p.region_id);
    if (!g) {
      g = {
        id: p.region_id, name: p.region_name, lat: p._rlat, lng: p._rlng,
        total: 0, npc: 0, mine: 0, taken: 0, posts: 0, comments: 0, heat: 0, provinces: 0,
      };
      byRegion.set(p.region_id, g);
    }
    g.total += p.total; g.npc += p.npc; g.mine += p.mine; g.taken += p.taken;
    g.posts += p.posts; g.comments += p.comments; g.heat += p.heat; g.provinces++;
  }
  res.json([...byRegion.values()].filter(visible).map((g) => ({ ...g, hot: g.heat >= HOT_THRESHOLD })));
});

// GET /neighborhoods/search?q=
router.get("/search", (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 40);
  if (!q) return res.json([]);
  const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;
  const rows = db
    .prepare(
      `SELECT n.id, n.name, n.status, n.lat, n.lng, p.name AS province_name, r.name AS region_name
       FROM neighborhoods n
       JOIN regions r ON r.id = n.parent_region_id
       LEFT JOIN provinces p ON p.id = n.province_id
       WHERE n.name ILIKE ? ESCAPE '\\' OR p.name ILIKE ? ESCAPE '\\' OR r.name ILIKE ? ESCAPE '\\'
       ORDER BY (n.name ILIKE ? ESCAPE '\\') DESC, (p.name ILIKE ? ESCAPE '\\') DESC, r.name, n.name
       LIMIT 20`
    )
    .all(contains, contains, contains, prefix, prefix);
  res.json(rows);
});

// GET /neighborhoods?province_id=<id> | ?bbox=s,w,n,e | ?mine=1 | ?region_id=<id>
// 필터가 없으면 전체를 돌려준다(v2/v3 옛 화면 호환) — 새 지도는 절대 필터 없이 부르지 않는다.
// 합산은 전부 집계 LEFT JOIN 한 방으로 가져온다(행마다 조회하면 요청당 쿼리가 수천 번 나간다).
router.get("/", optionalAuth, (req, res) => {
  const { region_id, province_id, bbox, mine } = req.query;
  const userId = req.userId || null;
  const where = [];
  const params = [userId];

  if (region_id) { where.push("n.parent_region_id = ?"); params.push(region_id); }
  if (province_id) { where.push("n.province_id = ?"); params.push(province_id); }
  if (mine) {
    if (!userId) return res.json([]);
    where.push("n.dominant_user_id = ?");
    params.push(userId);
  }
  if (req.query.resisting) {
    if (!userId) return res.json([]);
    where.push("res.total > 0"); // 저항 포인트가 쌓인 곳 — 반란(재탈환)을 노릴 수 있는 영토
  }
  if (bbox) {
    const [s, w, n, e] = String(bbox).split(",").map(Number);
    if ([s, w, n, e].some((v) => Number.isNaN(v))) return res.status(400).json({ error: "bbox 형식은 s,w,n,e 입니다." });
    where.push("n.lat BETWEEN ? AND ?");
    params.push(s, n);
    if (w <= e) { where.push("n.lng BETWEEN ? AND ?"); params.push(w, e); }
    else { where.push("(n.lng >= ? OR n.lng <= ?)"); params.push(w, e); } // 날짜변경선을 걸친 화면
  }

  const rows = db
    .prepare(
      `SELECT n.*, r.name AS region_name, p.name AS province_name, u.nickname AS dominant_nickname,
              COALESCE(c.total, 0) AS total_points,
              res.total AS my_resistance_points
       FROM neighborhoods n
       JOIN regions r ON r.id = n.parent_region_id
       LEFT JOIN provinces p ON p.id = n.province_id
       LEFT JOIN users u ON u.id = n.dominant_user_id
       LEFT JOIN (
         SELECT neighborhood_id, SUM(points) AS total
         FROM neighborhood_contributions GROUP BY neighborhood_id
       ) c ON c.neighborhood_id = n.id
       LEFT JOIN (
         SELECT neighborhood_id, SUM(points) AS total
         FROM neighborhood_resistance WHERE user_id = ? GROUP BY neighborhood_id
       ) res ON res.neighborhood_id = n.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY r.name, n.name
       ${bbox ? `LIMIT ${LEAF_LIMIT}` : ""}`
    )
    .all(...params);

  res.json(rows.map((n) => ({
    id: n.id,
    parent_region_id: n.parent_region_id,
    province_id: n.province_id,
    region_name: n.region_name,
    province_name: n.province_name,
    name: n.name,
    status: n.status,
    npc_difficulty: n.npc_difficulty,
    dominant_user_id: n.dominant_user_id,
    dominant_nickname: n.dominant_nickname,
    total_points: n.total_points,
    lat: n.lat,
    lng: n.lng,
    my_resistance_points: userId ? n.my_resistance_points || 0 : null,
  })));
});

// GET /neighborhoods/:id — 상세(기여도 상위 랭킹 + 인접 목록 포함)
router.get("/:id", optionalAuth, (req, res) => {
  const n = db
    .prepare(
      `SELECT n.*, r.name AS region_name, p.name AS province_name, u.nickname AS dominant_nickname
       FROM neighborhoods n
       JOIN regions r ON r.id = n.parent_region_id
       LEFT JOIN provinces p ON p.id = n.province_id
       LEFT JOIN users u ON u.id = n.dominant_user_id
       WHERE n.id = ?`
    )
    .get(req.params.id);
  if (!n) return res.status(404).json({ error: "동을 찾을 수 없습니다." });

  // 인접 영토의 누적 정복력은 "어디서 출병할지" 고르는 기준이라 함께 보낸다(클라이언트가
  // 전체 목록을 더 이상 들고 있지 않다).
  const adjacent = db
    .prepare(
      `SELECT adj.id, adj.name, adj.status, adj.dominant_user_id,
              (SELECT COALESCE(SUM(points), 0) FROM neighborhood_contributions WHERE neighborhood_id = adj.id) AS total_points
       FROM neighborhood_adjacency na
       JOIN neighborhoods adj ON adj.id = na.adjacent_neighborhood_id
       WHERE na.neighborhood_id = ?
       ORDER BY adj.name`
    )
    .all(req.params.id);

  res.json({
    id: n.id,
    parent_region_id: n.parent_region_id,
    province_id: n.province_id,
    region_name: n.region_name,
    province_name: n.province_name,
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
  clusterCache.rows = null; // 해방되면 미개척 수가 바뀌므로 묶음 캐시를 버린다
  res.status(201).json(result);
});

// POST /neighborhoods/:id/attack
// body: { from_neighborhood_id }  — 반란(재탈환) 특별 공격권이 있으면 생략 가능(서버가 저항 포인트로 판단).
// 클라이언트가 보낸 승패 주장은 없다 — 결과는 이 응답이 곧 최종 판정이다.
router.post("/:id/attack", requireAuth, (req, res) => {
  const { from_neighborhood_id } = req.body || {};
  const result = attemptAttack(req.params.id, req.userId, from_neighborhood_id || null, req.ip);
  if (result.error) return res.status(result.status).json({ error: result.error });
  clusterCache.rows = null;
  res.status(200).json(result);
});

module.exports = router;
