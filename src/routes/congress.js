const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const {
  getApprovalTally,
  resolveApprovalIfReady,
  CONGRESS_POWER_THRESHOLD,
  APPROVAL_RATIO,
} = require("../services/congress");

const router = express.Router();

// GET /congress-approvals/:id
router.get("/:id", (req, res) => {
  const approval = db.prepare("SELECT * FROM congress_approvals WHERE id = ?").get(req.params.id);
  if (!approval) return res.status(404).json({ error: "승인 요청을 찾을 수 없습니다." });

  const tally = getApprovalTally(req.params.id);
  res.json({ ...approval, ...tally, congress_power_threshold: CONGRESS_POWER_THRESHOLD, approval_ratio: APPROVAL_RATIO });
});

// POST /congress-approvals/:id/vote
// body: { verdict: 'accept' | 'reject' }
// 정책: 선포측 지역 정당원만 투표 가능. 1인 1표.
router.post("/:id/vote", requireAuth, (req, res) => {
  const { verdict } = req.body || {};
  if (!verdict || !["accept", "reject"].includes(verdict)) {
    return res.status(400).json({ error: "verdict는 'accept' 또는 'reject'여야 합니다." });
  }

  const approval = db.prepare("SELECT * FROM congress_approvals WHERE id = ?").get(req.params.id);
  if (!approval) return res.status(404).json({ error: "승인 요청을 찾을 수 없습니다." });
  if (approval.status !== "voting") {
    return res.status(409).json({ error: "이미 종료된 투표입니다." });
  }

  const voter = db.prepare("SELECT region_id FROM users WHERE id = ?").get(req.userId);
  if (voter.region_id !== approval.attacker_region_id) {
    return res.status(403).json({ error: "선포측 지역 시민만 투표할 수 있습니다." });
  }
  const isPartyMember = db.prepare("SELECT id FROM party_members WHERE user_id = ?").get(req.userId);
  if (!isPartyMember) {
    return res.status(403).json({ error: "정당원만 국회 승인 투표에 참여할 수 있습니다." });
  }

  const existing = db
    .prepare("SELECT id FROM congress_votes WHERE approval_id = ? AND voter_id = ?")
    .get(req.params.id, req.userId);
  if (existing) return res.status(409).json({ error: "이미 투표하셨습니다." });

  db.prepare("INSERT INTO congress_votes (id, approval_id, voter_id, verdict) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    req.params.id,
    req.userId,
    verdict
  );

  const resolved = resolveApprovalIfReady(req.params.id);
  const tally = getApprovalTally(req.params.id);

  res.status(201).json({
    ...tally,
    approval_status: resolved ? resolved.status : "voting",
    war: resolved && resolved.war ? resolved.war : undefined,
  });
});

module.exports = router;
