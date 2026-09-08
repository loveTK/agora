const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { regionMilitaryPower } = require("../services/military");
const { attemptFollowerConquest } = require("../services/conquest");

const router = express.Router();

// "지금 뜨는 지역" 배지 기준 — 최근 1시간 내 새 논증 등록 수가 이 값 이상이면 노출.
// 기획 확정 전 임시값이라 상수로 분리해뒀다(나중에 조정 시 이 값만 바꾸면 됨).
const TRENDING_ARGUMENT_THRESHOLD_PER_HOUR = 3;

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
              ) AS has_active_war,
              (SELECT COUNT(*) FROM arguments a
                 JOIN threads t ON t.id = a.thread_id
                 WHERE t.region_id = regions.id
                   AND a.created_at >= datetime('now', '-1 hour')) AS recent_argument_count
       FROM regions ORDER BY name`
    )
    .all();
  res.json(
    regions.map((r) => ({
      ...r,
      has_active_war: !!r.has_active_war,
      is_trending: r.recent_argument_count >= TRENDING_ARGUMENT_THRESHOLD_PER_HOUR,
    }))
  );
});

// GET /regions/:id
router.get("/:id", (req, res) => {
  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const population = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE region_id = ?")
    .get(req.params.id).count;

  const recentArgumentCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM arguments a
       JOIN threads t ON t.id = a.thread_id
       WHERE t.region_id = ? AND a.created_at >= datetime('now', '-1 hour')`
    )
    .get(req.params.id).count;

  res.json({ ...region, population, is_trending: recentArgumentCount >= TRENDING_ARGUMENT_THRESHOLD_PER_HOUR });
});

// GET /regions/:id/threads
// 해당 지역의 논제 목록 (최신순)
router.get("/:id/threads", (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  // 지도지역위젯(700x500)에서 발의자/소속국가/참여인원/추천비추천바보까지 한 번에 보여주기 위해
  // 참여자 수·반응 집계까지 이 목록 응답에 같이 실어 보낸다(위젯에서 논제 하나씩 추가 요청 안 해도 되게).
  const threads = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.created_at, t.author_id, u.nickname AS author_nickname,
              ur.name AS author_region_name,
              (SELECT COUNT(*) FROM arguments a WHERE a.thread_id = t.id) AS argument_count,
              COALESCE((SELECT SUM(CASE WHEN vote_type = 'up' THEN weight ELSE 0 END) FROM thread_votes WHERE thread_id = t.id), 0) AS thread_upvotes,
              COALESCE((SELECT SUM(CASE WHEN vote_type = 'down' THEN weight ELSE 0 END) FROM thread_votes WHERE thread_id = t.id), 0) AS thread_downvotes,
              COALESCE((SELECT SUM(weight) FROM laugh_reactions WHERE target_type = 'thread' AND target_id = t.id), 0) AS thread_laugh_count,
              (SELECT COUNT(*) FROM (
                 SELECT author_id AS uid FROM arguments WHERE thread_id = t.id
                 UNION
                 SELECT voter_id AS uid FROM thread_votes WHERE thread_id = t.id
                 UNION
                 SELECT user_id AS uid FROM laugh_reactions WHERE target_type = 'thread' AND target_id = t.id
               )) AS participant_count
       FROM threads t
       JOIN users u ON u.id = t.author_id
       LEFT JOIN regions ur ON ur.id = u.region_id
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
      `SELECT d.*, u.nickname,
              (SELECT p.name FROM party_members pm JOIN parties p ON p.id = pm.party_id
                 WHERE pm.user_id = d.user_id) AS party_name,
              (SELECT r.name FROM religion_members rm JOIN religions r ON r.id = rm.religion_id
                 WHERE rm.user_id = d.user_id) AS religion_name
       FROM dominance d JOIN users u ON u.id = d.user_id
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

// POST /regions/:id/conquer
// 정책: 본인 소속 지역이고, 팔로워 수가 그 지역 소속 인원보다 많으면 스트릭 없이 즉시 지배자가 된다.
router.post("/:id/conquer", requireAuth, (req, res) => {
  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(req.params.id);
  if (!region) return res.status(404).json({ error: "지역을 찾을 수 없습니다." });

  const result = attemptFollowerConquest(req.params.id, req.userId);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(200).json(result);
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
