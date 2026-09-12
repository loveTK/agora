const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { db } = require("../db");
const { JWT_SECRET } = require("../middleware/authMiddleware");
const { rateLimit } = require("../middleware/rateLimit");
const { belligerenceTier } = require("../services/belligerence");
const { levelProgress } = require("../services/experience");

const router = express.Router();
const authLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 }); // IP당 15분 10회 — 브루트포스 차단

// 서버 .env에 GOOGLE_CLIENT_ID가 없으면 구글 로그인 자체를 꺼둔다(프론트도 버튼을 안 그림) —
// 설정 전에는 그냥 없는 기능처럼 동작하게 해서 반쪽짜리 기능이 배포되지 않게 함.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || null;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function issueToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

function toAuthUser(user) {
  const progress = levelProgress(user.xp || 0);
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    region_id: user.region_id,
    rank: user.rank,
    reputation: user.reputation,
    belligerence: user.belligerence,
    belligerence_tier: belligerenceTier(user.belligerence),
    xp: progress.xp,
    level: progress.level,
    xp_current_level: progress.current_level_xp,
    xp_next_level: progress.next_level_xp,
    xp_to_next: progress.xp_to_next,
  };
}

// POST /auth/signup
// body: { email, password, nickname, region_id }
router.post("/signup", authLimit, (req, res) => {
  const { email, password, nickname, region_id } = req.body || {};

  if (!email || !password || !nickname || !region_id) {
    return res.status(400).json({ error: "email, password, nickname, region_id는 필수입니다." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "비밀번호는 8자 이상이어야 합니다." });
  }

  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(region_id);
  if (!region) {
    return res.status(400).json({ error: "존재하지 않는 지역입니다." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "이미 가입된 이메일입니다." });
  }

  const id = randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const signupIp = req.ip || null;

  db.prepare(
    `INSERT INTO users (id, email, password_hash, nickname, region_id, signup_ip)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email, passwordHash, nickname, region_id, signupIp);

  // 어뷰징 1차: 같은 IP에서 24시간 내 가입이 몰리면 다중 계정 의심으로 플래그만 남긴다.
  // (자동 차단은 하지 않음 — 오탐으로 정상 유저를 막지 않기 위해 관리자 검토용으로만 사용)
  if (signupIp) {
    const recentSameIp = db
      .prepare(
        `SELECT COUNT(*) AS count FROM users
         WHERE signup_ip = ? AND created_at >= (now() + interval '-1 day')`
      )
      .get(signupIp).count;

    const SUSPICIOUS_SIGNUP_THRESHOLD = 5;
    if (recentSameIp >= SUSPICIOUS_SIGNUP_THRESHOLD) {
      db.prepare(
        "INSERT INTO abuse_flags (id, type, user_id, detail) VALUES (?, 'signup_ip_burst', ?, ?)"
      ).run(randomUUID(), id, `IP ${signupIp}에서 24시간 내 ${recentSameIp}건 가입`);
    }
  }

  const token = issueToken(id);
  const created = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  res.status(201).json({ token, user: toAuthUser(created) });
});

// POST /auth/login
// body: { email, password }
router.post("/login", authLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email, password는 필수입니다." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
  }

  res.json({ token: issueToken(user.id), user: toAuthUser(user) });
});

// GET /auth/google-client-id
// 프론트가 구글 로그인 버튼을 그릴지 말지 결정하는 용도.
router.get("/google-client-id", (req, res) => {
  res.json({ client_id: GOOGLE_CLIENT_ID });
});

// POST /auth/google
// body: { credential, nickname?, region_id? }
// 구글 신원확인(credential)만 먼저 검증 — 이미 있는 이메일이면 바로 로그인, 처음 보는
// 이메일인데 nickname/region_id가 없으면 needs_profile:true로 알려주고, 있으면 그걸로 가입시킨다.
router.post("/google", authLimit, async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ error: "구글 로그인이 아직 설정되지 않았습니다." });
  }
  const { credential, nickname, region_id } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: "credential은 필수입니다." });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: "구글 인증에 실패했습니다." });
  }
  if (!payload.email_verified) {
    return res.status(401).json({ error: "인증되지 않은 구글 이메일입니다." });
  }

  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(payload.email);
  if (existing) {
    return res.json({ token: issueToken(existing.id), user: toAuthUser(existing) });
  }

  if (!nickname || !region_id) {
    const suggestedNickname = (payload.name || payload.email.split("@")[0]).slice(0, 20);
    return res.json({ needs_profile: true, suggested_nickname: suggestedNickname });
  }

  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(region_id);
  if (!region) {
    return res.status(400).json({ error: "존재하지 않는 지역입니다." });
  }

  const id = randomUUID();
  // 구글로 가입한 계정은 비밀번호 로그인을 안 쓰지만 컬럼이 NOT NULL이라 아무도 못 맞출 랜덤값을 채워둔다.
  const unusablePasswordHash = bcrypt.hashSync(randomUUID(), 10);
  db.prepare(
    `INSERT INTO users (id, email, password_hash, nickname, region_id, signup_ip)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, payload.email, unusablePasswordHash, nickname, region_id, req.ip || null);

  const created = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  res.status(201).json({ token: issueToken(id), user: toAuthUser(created) });
});

module.exports = router;
