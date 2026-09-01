const express = require("express");
const { settleAllActiveThreads } = require("../services/judgment");
const { db } = require("../db");

const router = express.Router();

// POST /internal/judgments/settle
// 운영 서버에서 cron(예: 24시간 주기)으로 호출하는 배치 엔드포인트.
// 실시간 확정(threads.js의 judgment-vote)과 동일 로직을 재사용하므로,
// 실시간 확정을 못 받은 논제(예: 배치 도입 이후 트래픽 급증 시)를 보정하는 역할을 한다.
// 운영 환경에서는 이 경로를 외부에 노출하지 말고 내부망/관리자 토큰으로 보호할 것.
router.post("/judgments/settle", (req, res) => {
  const settled = settleAllActiveThreads();
  res.json({ settled_count: settled.length, settled });
});

// GET /internal/abuse/flags
// 이상 패턴 자동 탐지 로그 조회 (관리자 검토용). 운영 환경에서는 관리자 인증 필수.
router.get("/abuse/flags", (req, res) => {
  const flags = db
    .prepare("SELECT * FROM abuse_flags ORDER BY created_at DESC LIMIT 100")
    .all();
  res.json(flags);
});

// GET /internal/reports?status=pending
// 관리자용 신고 목록 조회
router.get("/reports", (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all();
  res.json(rows);
});

// PATCH /internal/reports/:id
// body: { status: 'reviewed' | 'dismissed' | 'actioned', reviewer_note? }
// - actioned: 신고가 정당함 -> 대상 콘텐츠를 숨김 처리
// - dismissed: 신고가 부당함 -> 대상 콘텐츠 숨김 해제(자동 숨김되어 있었다면 복구)
// - reviewed: 검토는 했으나 아직 최종 결정 전(숨김 상태 유지)
router.patch("/reports/:id", (req, res) => {
  const { status, reviewer_note } = req.body || {};
  if (!status || !["reviewed", "dismissed", "actioned"].includes(status)) {
    return res.status(400).json({ error: "status는 'reviewed', 'dismissed', 'actioned' 중 하나여야 합니다." });
  }

  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "신고 내역을 찾을 수 없습니다." });

  db.prepare(
    "UPDATE reports SET status = ?, reviewer_note = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(status, reviewer_note || null, req.params.id);

  if (report.target_type !== "user") {
    const table = report.target_type === "thread" ? "threads" : "arguments";
    if (status === "actioned") {
      db.prepare(`UPDATE ${table} SET hidden = 1 WHERE id = ?`).run(report.target_id);
    } else if (status === "dismissed") {
      db.prepare(`UPDATE ${table} SET hidden = 0 WHERE id = ?`).run(report.target_id);
    }
  }

  const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  res.json(updated);
});

module.exports = router;
