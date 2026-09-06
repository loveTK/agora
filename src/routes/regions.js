const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { regionMilitaryPower } = require("../services/military");

const router = express.Router();

// GET /regions
// 지도 렌더링용 경량 목록 (상태값만)
router.get("/", (req, res) => {
  const regions = db
    .prepare(
      `SELECT id, name, status, lat, lng,
              EXISTS(
                SELECT 1 FROM wars w
                WHERE (w.attacker_region_id = regions.id OR w.defender_region_id = regions.id)
                  AND w.status IN ('voting', 'accepted')
              ) AS has_active_war
       FROM regions ORDER BY name`
    )
    .all();
  res.json(regions.map((r) => ({ ...r, has_active_war: !!r.has_active_war })));
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

// GET /regions/:id/dominance
// 현재 이 지역의 지배자(있다면)와 명예의 전당용 최상위 후보 목록
router.get("/:id/dominance", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const ruler = db
    .prepare(
      `SELECT d.*, u.nickname FROM dominance d JOIN users u ON u.id = d.user_id
       WHERE d.region_id = ?`
    )
    .get(req.params.id);

  const topCandidates = db
    .prepare(
      `SELECT dc.user_id, dc.streak_days, u.nickname FROM dominance_candidates dc
       JOIN users u ON u.id = dc.user_id
       WHERE dc.region_id = ? ORDER BY dc.streak_days DESC LIMIT 5`
    )
    .all(req.params.id);

  res.json({ ruler: ruler || null, top_candidates: topCandidates });
});

// POST /regions/:id/dominance/cloak
// body: { design_asset_url }
// 정책: 현재 이 지역의 지배자만 발급 가능. 결제 없이 무료(free) — 본인 디자인, 시스템이 아니라 본인이 창작자.
// 폭군 전환 시 색상이 검정으로 바뀌는 연출은 저장값이 아니라 조회 시점에 dominance.status를 보고
// 동적으로 계산한다(GET /users/:id/inventory 참고) — 그래야 상태가 바뀔 때마다 별도 동기화가 필요 없다.
router.post("/:id/dominance/cloak", requireAuth, (req, res) => {
  const { design_asset_url } = req.body || {};
  if (!design_asset_url) {
    return res.status(400).json({ error: "design_asset_url은 필수입니다." });
  }

  const dominanceRow = db
    .prepare("SELECT * FROM dominance WHERE region_id = ? AND user_id = ?")
    .get(req.params.id, req.userId);
  if (!dominanceRow) {
    return res.status(403).json({ error: "현재 이 지역의 지배자만 망토를 발급할 수 있습니다." });
  }

  const existing = db
    .prepare(
      "SELECT * FROM items WHERE owner_type = 'dominance' AND owner_id = ? AND creator_id = ? AND slot_type = 'cloak'"
    )
    .get(req.params.id, req.userId);
  if (existing) {
    return res.status(409).json({ error: "이미 이 재위 기간에 발급한 망토가 있습니다.", item_id: existing.id });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO items (id, creator_id, owner_type, owner_id, slot_type, design_asset_url, payment_status)
     VALUES (?, ?, 'dominance', ?, 'cloak', ?, 'free')`
  ).run(id, req.userId, req.params.id, design_asset_url);
  db.prepare("INSERT INTO user_inventory (id, user_id, item_id) VALUES (?, ?, ?)").run(
    randomUUID(),
    req.userId,
    id
  );

  res.status(201).json({ id, slot_type: "cloak" });
});

// GET /regions/:id/military-power
router.get("/:id/military-power", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });
  res.json({ region_id: req.params.id, power: regionMilitaryPower(req.params.id) });
});

// GET /regions/:id/wars
// 이 지역이 공격측이든 방어측이든 관련된 전쟁 목록 (최신순)
router.get("/:id/wars", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const wars = db
    .prepare(
      `SELECT * FROM wars WHERE attacker_region_id = ? OR defender_region_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.params.id, req.params.id);

  res.json(wars);
});

// GET /regions/:id/congress-approvals
// 이 지역이 선포측인 국회 승인투표 목록(최신순) — 진행 중인 투표 UI에 사용
router.get("/:id/congress-approvals", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const approvals = db
    .prepare(`SELECT * FROM congress_approvals WHERE attacker_region_id = ? ORDER BY created_at DESC`)
    .all(req.params.id);

  res.json(approvals);
});

// GET /regions/:id/cultural-influence
// 이 지역에서 "사상 영향권"으로 인정된 외부 유저 목록 (영향력 높은 순)
router.get("/:id/cultural-influence", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const influencers = db
    .prepare(
      `SELECT cz.user_id, u.nickname, i.points, cz.achieved_at
       FROM cultural_influence_zones cz
       JOIN users u ON u.id = cz.user_id
       LEFT JOIN influence i ON i.user_id = cz.user_id AND i.region_id = cz.foreign_region_id
       WHERE cz.foreign_region_id = ?
       ORDER BY i.points DESC`
    )
    .all(req.params.id);

  res.json(influencers);
});

module.exports = router;
