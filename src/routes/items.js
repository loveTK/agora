const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
const CREATION_FEE = 15000; // 종교/정당 아이템 등록비 (기획 확정 금액, 1회)

// GET /items/shop
// 상점 카탈로그 — owner_type='shop'인(누구 소유도 아닌, 착용 조건도 없는) 아이템만 노출.
router.get("/shop", (req, res) => {
  const items = db.prepare("SELECT * FROM items WHERE owner_type = 'shop' ORDER BY created_at").all();
  res.json(items);
});

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

// POST /items/:id/acquire
// 무료(payment_status='free') 아이템 전용 — 결제 없이 바로 인벤토리에 추가. 착용 조건 없음(누구나 가능).
router.post("/:id/acquire", requireAuth, (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "아이템을 찾을 수 없습니다." });
  if (item.payment_status !== "free") {
    return res.status(400).json({ error: "무료 아이템만 이 API로 받을 수 있습니다." });
  }

  const already = db
    .prepare("SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ?")
    .get(req.userId, item.id);
  if (already) return res.status(409).json({ error: "이미 보유한 아이템입니다." });

  db.prepare("INSERT INTO user_inventory (id, user_id, item_id) VALUES (?, ?, ?)").run(
    randomUUID(),
    req.userId,
    item.id
  );
  res.status(201).json({ item_id: item.id });
});

module.exports = router;
