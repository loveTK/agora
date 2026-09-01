const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { JWT_SECRET } = require("../middleware/authMiddleware");

const router = express.Router();

function issueToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

// POST /auth/signup
// body: { email, password, nickname, region_id }
router.post("/signup", (req, res) => {
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
         WHERE signup_ip = ? AND datetime(created_at) >= datetime('now', '-1 day')`
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
  res.status(201).json({
    token,
    user: { id, email, nickname, region_id, rank: "citizen", reputation: 0 },
  });
});

// POST /auth/login
// body: { email, password }
router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email, password는 필수입니다." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
  }

  const token = issueToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      region_id: user.region_id,
      rank: user.rank,
      reputation: user.reputation,
    },
  });
});

module.exports = router;
