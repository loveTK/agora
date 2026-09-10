const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
}

// 비로그인도 허용하되, 토큰이 있으면 req.userId를 채워준다(공개 GET에서 "내 저항 포인트" 같은
// 개인화 필드를 곁들이되 로그인을 강제하진 않을 때 씀). 잘못된/만료된 토큰은 그냥 비로그인 취급한다.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.userId = jwt.verify(token, JWT_SECRET).sub;
    } catch (err) { /* 무시 — 비로그인처럼 취급 */ }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };
