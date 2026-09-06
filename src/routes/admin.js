const express = require("express");
const { ADMIN_TOKEN, ADMIN_ID, ADMIN_PASSWORD } = require("../middleware/adminAuth");

const router = express.Router();

// POST /admin/login
// body: { id, password } — 관리자 페이지 진입용. 성공 시 기존 /internal/* 라우트가 쓰는
// X-Admin-Token 값을 그대로 내려준다(별도 세션 체계 없이 기존 requireAdmin 재사용).
router.post("/login", (req, res) => {
  const { id, password } = req.body || {};
  if (id !== ADMIN_ID || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "ID 또는 비밀번호가 올바르지 않습니다." });
  }
  res.json({ token: ADMIN_TOKEN });
});

module.exports = router;
