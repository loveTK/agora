const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev-admin-token-change-me";
// 실제 ID/PW는 코드가 아니라 서버의 .env에만 넣는다(ADMIN_TOKEN과 동일한 원칙).
// 로컬 개발 편의를 위한 기본값이라 운영에서는 반드시 .env로 덮어써야 한다.
const ADMIN_ID = process.env.ADMIN_ID || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-in-env";

// 운영 환경에서는 반드시 강력한 랜덤 토큰으로 교체하고, 가능하면 내부망으로 추가 제한할 것.
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "관리자 인증이 필요합니다." });
  }
  next();
}

module.exports = { requireAdmin, ADMIN_TOKEN, ADMIN_ID, ADMIN_PASSWORD };
