const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { containsBannedWord } = require("../services/contentFilter");

const router = express.Router();
const BODY_MAX = 1000;

// POST /messages
// body: { receiver_id, body }
router.post("/", requireAuth, (req, res) => {
  const { receiver_id, body } = req.body || {};
  if (!receiver_id || !body || !body.trim()) {
    return res.status(400).json({ error: "receiver_id, body는 필수입니다." });
  }
  if (receiver_id === req.userId) {
    return res.status(400).json({ error: "본인에게는 쪽지를 보낼 수 없습니다." });
  }
  if (body.length > BODY_MAX) {
    return res.status(400).json({ error: `쪽지는 ${BODY_MAX}자 이내로 작성해주세요.` });
  }
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "부적절한 표현이 포함되어 있어 보낼 수 없습니다." });
  }

  const receiver = db.prepare("SELECT id FROM users WHERE id = ?").get(receiver_id);
  if (!receiver) return res.status(404).json({ error: "받는 사람을 찾을 수 없습니다." });

  const id = randomUUID();
  db.prepare(
    "INSERT INTO messages (id, sender_id, receiver_id, body) VALUES (?, ?, ?, ?)"
  ).run(id, req.userId, receiver_id, body.trim());

  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(id);
  res.status(201).json(message);
});

// GET /messages/conversations
// 로그인한 유저가 주고받은 상대방 목록을, 최근 대화 순으로 반환한다(마지막 쪽지 미리보기 + 안읽음 수 포함).
router.get("/conversations", requireAuth, (req, res) => {
  const partners = db
    .prepare(
      `SELECT other_id, MAX(created_at) AS last_at FROM (
         SELECT receiver_id AS other_id, created_at FROM messages WHERE sender_id = ? AND hidden = 0
         UNION ALL
         SELECT sender_id AS other_id, created_at FROM messages WHERE receiver_id = ? AND hidden = 0
       )
       GROUP BY other_id ORDER BY last_at DESC`
    )
    .all(req.userId, req.userId);

  const conversations = partners.map((p) => {
    const other = db.prepare("SELECT id, nickname FROM users WHERE id = ?").get(p.other_id);
    const lastMessage = db
      .prepare(
        `SELECT body, sender_id, created_at FROM messages
         WHERE hidden = 0 AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(req.userId, p.other_id, p.other_id, req.userId);
    const unreadCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM messages WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL AND hidden = 0"
      )
      .get(p.other_id, req.userId).count;

    return {
      user_id: p.other_id,
      nickname: other ? other.nickname : "(탈퇴한 유저)",
      last_message: lastMessage ? lastMessage.body : null,
      last_at: p.last_at,
      unread_count: unreadCount,
    };
  });

  res.json(conversations);
});

// GET /messages/:userId
// 로그인한 유저와 :userId 간의 대화 내역 (시간순).
router.get("/:userId", requireAuth, (req, res) => {
  const messages = db
    .prepare(
      `SELECT * FROM messages
       WHERE hidden = 0 AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
       ORDER BY created_at ASC`
    )
    .all(req.userId, req.params.userId, req.params.userId, req.userId);

  res.json(messages);
});

// PATCH /messages/:id/read
// 정책: 받는 사람 본인만 자신에게 온 쪽지를 읽음 처리할 수 있다.
router.patch("/:id/read", requireAuth, (req, res) => {
  const message = db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
  if (!message) return res.status(404).json({ error: "쪽지를 찾을 수 없습니다." });
  if (message.receiver_id !== req.userId) {
    return res.status(403).json({ error: "본인이 받은 쪽지만 읽음 처리할 수 있습니다." });
  }
  if (!message.read_at) {
    db.prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ?").run(req.params.id);
  }
  res.json({ id: req.params.id, read_at: db.prepare("SELECT read_at FROM messages WHERE id = ?").get(req.params.id).read_at });
});

module.exports = router;
