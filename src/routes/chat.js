const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { containsBannedWord } = require("../services/contentFilter");

const router = express.Router();
const BODY_MAX = 200;
const RECENT_LIMIT = 50; // 최근 이만큼만 유지 — 초과분은 매 전송 시점에 정리(오래된 메시지 자동 청소)
const RATE_LIMIT_MS = 3000; // 유저당 도배 방지: 3초에 1메시지

// 유저별 마지막 전송 시각(ms). 프로세스 메모리에만 두는 단순 구현이라 서버 재시작 시 초기화되지만,
// 목적이 짧은 도배 방지라 굳이 DB/Redis까지 갈 필요는 없다.
const lastSentAt = new Map();

function toPublicMessage(row) {
  return { id: row.id, user_id: row.user_id, nickname: row.nickname, body: row.body, created_at: row.created_at };
}

// GET /chat/recent — 최근 메시지 오래된순(위→아래로 그대로 렌더 가능하게)
router.get("/recent", (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.user_id, c.body, c.created_at, u.nickname
       FROM chat_messages c JOIN users u ON u.id = c.user_id
       WHERE c.hidden = 0
       ORDER BY c.created_at DESC LIMIT ?`
    )
    .all(RECENT_LIMIT);
  res.json(rows.reverse().map(toPublicMessage));
});

// POST /chat — body: { body }
// 로그인 필요. 소켓으로 직접 안 보내고 REST로 받아 검증(금칙어/도배 제한)한 뒤 io로 브로드캐스트한다
// — 소켓 쪽에 별도 인증을 안 태워도 되게 하기 위한 선택.
router.post("/", requireAuth, (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: "메시지 내용을 입력해주세요." });
  }
  if (body.length > BODY_MAX) {
    return res.status(400).json({ error: `메시지는 ${BODY_MAX}자 이내로 작성해주세요.` });
  }
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "부적절한 표현이 포함되어 있어 전송할 수 없습니다." });
  }

  const last = lastSentAt.get(req.userId);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    return res.status(429).json({ error: "너무 빠르게 전송하고 있습니다. 잠시 후 다시 시도해주세요." });
  }
  lastSentAt.set(req.userId, Date.now());

  const id = randomUUID();
  db.prepare("INSERT INTO chat_messages (id, user_id, body) VALUES (?, ?, ?)").run(id, req.userId, body.trim());

  // 최근 RECENT_LIMIT개를 넘는 과거 메시지는 바로 정리 — 트래픽이 낮아 매 전송마다 지워도 부담 없다.
  db.prepare(
    `DELETE FROM chat_messages WHERE id NOT IN (
       SELECT id FROM chat_messages ORDER BY created_at DESC LIMIT ?
     )`
  ).run(RECENT_LIMIT);

  const row = db
    .prepare(
      `SELECT c.id, c.user_id, c.body, c.created_at, u.nickname
       FROM chat_messages c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(id);
  const message = toPublicMessage(row);

  req.app.get("io").emit("chat:message", message);
  res.status(201).json(message);
});

module.exports = router;
