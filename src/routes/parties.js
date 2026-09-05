const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { PARTY_CREATE_FOLLOWER_THRESHOLD } = require("../services/factionThresholds");
const { grantExistingPaidItemsOnJoin } = require("../services/itemDistribution");
const { checkJoinBrigading } = require("../services/abuseDetection");

const router = express.Router();

function followerCount(userId) {
  return db.prepare("SELECT COUNT(*) AS count FROM follows WHERE followee_id = ?").get(userId).count;
}

function joinParty(partyId, userId, ip) {
  // 1인 1정당: 기존 소속이 있으면 탈퇴 처리 후 새로 가입
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM party_members WHERE user_id = ?").run(userId);
    db.prepare("INSERT INTO party_members (id, party_id, user_id, ip) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      partyId,
      userId,
      ip
    );
  });
  tx();
  grantExistingPaidItemsOnJoin("party", partyId, userId); // 이미 배포 확정된 뱃지가 있다면 즉시 지급
  checkJoinBrigading("party_members", "party_id", partyId, ip);
}

// POST /parties
// body: { name, platform }
// 정책: 창설 조건 = 팔로워 수 100 이상
router.post("/", requireAuth, (req, res) => {
  const { name, platform } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "정당명은 필수입니다." });
  }
  if (!platform || !platform.trim()) {
    return res.status(400).json({ error: "강령은 필수입니다." });
  }

  const followers = followerCount(req.userId);
  if (followers < PARTY_CREATE_FOLLOWER_THRESHOLD) {
    return res.status(403).json({
      error: `정당 창설은 팔로워 ${PARTY_CREATE_FOLLOWER_THRESHOLD}명 이상부터 가능합니다. (현재 ${followers}명)`,
    });
  }

  const existingName = db.prepare("SELECT id FROM parties WHERE name = ?").get(name.trim());
  if (existingName) return res.status(409).json({ error: "이미 존재하는 정당명입니다." });

  const id = randomUUID();
  db.prepare("INSERT INTO parties (id, founder_id, name, platform) VALUES (?, ?, ?, ?)").run(
    id,
    req.userId,
    name.trim(),
    platform.trim()
  );

  joinParty(id, req.userId, req.ip); // 창설자는 자동으로 당원이 됨

  res.status(201).json({ id, name: name.trim(), platform: platform.trim(), founder_id: req.userId });
});

// GET /parties/:id
router.get("/:id", (req, res) => {
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(req.params.id);
  if (!party) return res.status(404).json({ error: "정당을 찾을 수 없습니다." });

  const memberCount = db
    .prepare("SELECT COUNT(*) AS count FROM party_members WHERE party_id = ?")
    .get(req.params.id).count;

  res.json({ ...party, member_count: memberCount });
});

// POST /parties/:id/join
router.post("/:id/join", requireAuth, (req, res) => {
  const party = db.prepare("SELECT id FROM parties WHERE id = ?").get(req.params.id);
  if (!party) return res.status(404).json({ error: "정당을 찾을 수 없습니다." });

  joinParty(req.params.id, req.userId, req.ip);
  res.json({ party_id: req.params.id, joined: true });
});

// POST /parties/:id/items
// body: { design_asset_url }
// 정책: 창설자만 등록 가능. 정당이 발급하는 슬롯은 항상 '뱃지'. 결제 확정 전까지는 pending 상태.
router.post("/:id/items", requireAuth, (req, res) => {
  const { design_asset_url } = req.body || {};
  if (!design_asset_url) {
    return res.status(400).json({ error: "design_asset_url은 필수입니다." });
  }

  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(req.params.id);
  if (!party) return res.status(404).json({ error: "정당을 찾을 수 없습니다." });
  if (party.founder_id !== req.userId) {
    return res.status(403).json({ error: "창설자만 아이템을 등록할 수 있습니다." });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO items (id, creator_id, owner_type, owner_id, slot_type, design_asset_url, payment_status)
     VALUES (?, ?, 'party', ?, 'badge', ?, 'pending')`
  ).run(id, req.userId, req.params.id, design_asset_url);

  res.status(201).json({ id, slot_type: "badge", payment_status: "pending" });
});

module.exports = router;
