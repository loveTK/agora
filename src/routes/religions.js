const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { RELIGION_CREATE_REPUTATION_THRESHOLD, TENET_MIN, TENET_MAX } = require("../services/factionThresholds");
const { grantExistingPaidItemsOnJoin } = require("../services/itemDistribution");
const { checkJoinBrigading } = require("../services/abuseDetection");

const router = express.Router();

function joinReligion(religionId, userId, ip) {
  // 1인 1종교: 기존 소속이 있으면 탈퇴 처리 후 새로 가입
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM religion_members WHERE user_id = ?").run(userId);
    db.prepare(
      "INSERT INTO religion_members (id, religion_id, user_id, ip) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), religionId, userId, ip);
  });
  tx();
  grantExistingPaidItemsOnJoin("religion", religionId, userId); // 이미 배포 확정된 악세사리가 있다면 즉시 지급
  checkJoinBrigading("religion_members", "religion_id", religionId, ip);
}

// GET /religions
// 가입 화면에서 고를 수 있도록 전체 종교 목록(신자 수 포함)을 노출한다.
router.get("/", (req, res) => {
  const religions = db
    .prepare(
      `SELECT r.id, r.name, r.founder_id, u.nickname AS founder_nickname,
              (SELECT COUNT(*) FROM religion_members rm WHERE rm.religion_id = r.id) AS member_count
       FROM religions r JOIN users u ON u.id = r.founder_id
       ORDER BY member_count DESC`
    )
    .all();
  res.json(religions);
});

// POST /religions
// body: { name, tenet_thread_ids: [3~5개] }
// 정책: 창설 조건 = 명성 500 이상. 교리는 본인이 정립한 논제 3~5개 묶음.
router.post("/", requireAuth, (req, res) => {
  const { name, tenet_thread_ids } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "종교명은 필수입니다." });
  }
  if (
    !Array.isArray(tenet_thread_ids) ||
    tenet_thread_ids.length < TENET_MIN ||
    tenet_thread_ids.length > TENET_MAX
  ) {
    return res.status(400).json({ error: `교리는 논제 ${TENET_MIN}~${TENET_MAX}개로 구성해야 합니다.` });
  }

  const founder = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (founder.reputation < RELIGION_CREATE_REPUTATION_THRESHOLD) {
    return res.status(403).json({
      error: `종교 창설은 명성 ${RELIGION_CREATE_REPUTATION_THRESHOLD} 이상부터 가능합니다. (현재 ${founder.reputation})`,
    });
  }

  const existingName = db.prepare("SELECT id FROM religions WHERE name = ?").get(name.trim());
  if (existingName) return res.status(409).json({ error: "이미 존재하는 종교명입니다." });

  // 교리로 지정한 논제가 실제로 본인이 작성한 논제인지 검증
  for (const threadId of tenet_thread_ids) {
    const thread = db.prepare("SELECT id, author_id FROM threads WHERE id = ?").get(threadId);
    if (!thread) return res.status(400).json({ error: `존재하지 않는 논제입니다: ${threadId}` });
    if (thread.author_id !== req.userId) {
      return res.status(403).json({ error: "본인이 작성한 논제만 교리로 지정할 수 있습니다." });
    }
  }

  const id = randomUUID();
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO religions (id, founder_id, name) VALUES (?, ?, ?)").run(
      id,
      req.userId,
      name.trim()
    );
    const insertTenet = db.prepare(
      "INSERT INTO religion_tenets (id, religion_id, thread_id) VALUES (?, ?, ?)"
    );
    for (const threadId of tenet_thread_ids) {
      insertTenet.run(randomUUID(), id, threadId);
    }
  });
  tx();

  joinReligion(id, req.userId, req.ip); // 창설자는 자동으로 신자가 됨

  res.status(201).json({ id, name: name.trim(), founder_id: req.userId });
});

// GET /religions/:id
router.get("/:id", (req, res) => {
  const religion = db.prepare("SELECT * FROM religions WHERE id = ?").get(req.params.id);
  if (!religion) return res.status(404).json({ error: "종교를 찾을 수 없습니다." });

  const tenets = db
    .prepare(
      `SELECT t.id, t.title FROM religion_tenets rt
       JOIN threads t ON t.id = rt.thread_id
       WHERE rt.religion_id = ?`
    )
    .all(req.params.id);

  const memberCount = db
    .prepare("SELECT COUNT(*) AS count FROM religion_members WHERE religion_id = ?")
    .get(req.params.id).count;

  res.json({ ...religion, tenets, member_count: memberCount });
});

// POST /religions/:id/join
router.post("/:id/join", requireAuth, (req, res) => {
  const religion = db.prepare("SELECT id FROM religions WHERE id = ?").get(req.params.id);
  if (!religion) return res.status(404).json({ error: "종교를 찾을 수 없습니다." });

  joinReligion(req.params.id, req.userId, req.ip);
  res.json({ religion_id: req.params.id, joined: true });
});

// POST /religions/:id/items
// body: { design_asset_url }
// 정책: 창설자만 등록 가능. 종교가 발급하는 슬롯은 항상 '악세사리'. 등록 즉시 결제 대기(pending) 상태로 생성되며,
// 실제 배포는 결제 확정(POST /internal/payments/:sessionId/confirm) 이후 이루어진다.
router.post("/:id/items", requireAuth, (req, res) => {
  const { design_asset_url } = req.body || {};
  if (!design_asset_url) {
    return res.status(400).json({ error: "design_asset_url은 필수입니다." });
  }

  const religion = db.prepare("SELECT * FROM religions WHERE id = ?").get(req.params.id);
  if (!religion) return res.status(404).json({ error: "종교를 찾을 수 없습니다." });
  if (religion.founder_id !== req.userId) {
    return res.status(403).json({ error: "창설자만 아이템을 등록할 수 있습니다." });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO items (id, creator_id, owner_type, owner_id, slot_type, design_asset_url, payment_status)
     VALUES (?, ?, 'religion', ?, 'accessory', ?, 'pending')`
  ).run(id, req.userId, req.params.id, design_asset_url);

  res.status(201).json({ id, slot_type: "accessory", payment_status: "pending" });
});

module.exports = router;
