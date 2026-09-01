const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// 신고 누적 시 즉시 숨김 처리하는 임계값 (그림자 제한 — 최종 판단은 관리자가 이어서 함)
const AUTO_HIDE_REPORT_THRESHOLD = 5;

function targetExists(targetType, targetId) {
  if (targetType === "thread") {
    return !!db.prepare("SELECT id FROM threads WHERE id = ?").get(targetId);
  }
  if (targetType === "argument") {
    return !!db.prepare("SELECT id FROM arguments WHERE id = ?").get(targetId);
  }
  if (targetType === "user") {
    return !!db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  }
  return false;
}

function autoHideIfThresholdReached(targetType, targetId) {
  if (targetType === "user") return; // 유저 계정은 자동 숨김 대상이 아님(콘텐츠만 해당)

  const pendingCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM reports
       WHERE target_type = ? AND target_id = ? AND status = 'pending'`
    )
    .get(targetType, targetId).count;

  if (pendingCount < AUTO_HIDE_REPORT_THRESHOLD) return;

  const table = targetType === "thread" ? "threads" : "arguments";
  const alreadyHidden = db.prepare(`SELECT hidden FROM ${table} WHERE id = ?`).get(targetId);
  if (alreadyHidden && alreadyHidden.hidden) return; // 이미 숨김 처리됨

  db.prepare(`UPDATE ${table} SET hidden = 1 WHERE id = ?`).run(targetId);
  db.prepare(
    "INSERT INTO abuse_flags (id, type, detail) VALUES (?, 'content_report_burst', ?)"
  ).run(randomUUID(), `${targetType}:${targetId} — 신고 ${pendingCount}건 누적으로 자동 숨김`);
}

// POST /reports
// body: { target_type: 'thread' | 'argument' | 'user', target_id, reason }
router.post("/", requireAuth, (req, res) => {
  const { target_type, target_id, reason } = req.body || {};

  if (!target_type || !["thread", "argument", "user"].includes(target_type)) {
    return res.status(400).json({ error: "target_type은 'thread', 'argument', 'user' 중 하나여야 합니다." });
  }
  if (!target_id || !reason || !reason.trim()) {
    return res.status(400).json({ error: "target_id, reason은 필수입니다." });
  }
  if (!targetExists(target_type, target_id)) {
    return res.status(404).json({ error: "신고 대상을 찾을 수 없습니다." });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, req.userId, target_type, target_id, reason.trim());

  autoHideIfThresholdReached(target_type, target_id);

  res.status(201).json({ id, status: "pending" });
});

module.exports = router;
