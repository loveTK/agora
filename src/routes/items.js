const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
const CREATION_FEE = 15000; // 종교/정당 아이템 등록비 (기획 확정 금액, 1회)

// GET /items/:id
router.get("/:id", (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "아이템을 찾을 수 없습니다." });
  res.json(item);
});

// POST /items/:id/checkout
// 정책: 실제 PG(결제대행사) 연동 전까지의 모의 결제 세션 생성.
// 운영 전환 시 checkout_url을 실제 PG의 결제 페이지 URL로 교체하고,
// /internal/payments/:sessionId/confirm 부분을 PG 웹훅으로 대체하면 된다.
router.post("/:id/checkout", requireAuth, (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "아이템을 찾을 수 없습니다." });
  if (item.creator_id !== req.userId) {
    return res.status(403).json({ error: "아이템 창설자만 결제를 진행할 수 있습니다." });
  }
  if (item.payment_status !== "pending") {
    return res.status(409).json({ error: "이미 결제되었거나 결제가 필요 없는 아이템입니다." });
  }

  const sessionId = randomUUID();
  db.prepare(
    "INSERT INTO payment_sessions (id, item_id, amount) VALUES (?, ?, ?)"
  ).run(sessionId, item.id, CREATION_FEE);

  res.status(201).json({
    session_id: sessionId,
    checkout_url: `mock://payment/${sessionId}`, // 실제 PG 연동 전까지의 자리표시자 URL
    amount: CREATION_FEE,
  });
});

module.exports = router;
