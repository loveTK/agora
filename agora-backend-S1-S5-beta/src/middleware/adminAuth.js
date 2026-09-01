const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "dev-admin-token-change-me";

// 운영 환경에서는 반드시 강력한 랜덤 토큰으로 교체하고, 가능하면 내부망으로 추가 제한할 것.
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "관리자 인증이 필요합니다." });
  }
  next();
}

module.exports = { requireAdmin };
