const { ADMIN_TOKEN, ADMIN_ID, ADMIN_PASSWORD } = process.env;
for (const k of ["ADMIN_TOKEN", "ADMIN_ID", "ADMIN_PASSWORD"]) {
  if (!process.env[k]) throw new Error(`${k} env 필요 (.env.example 참고)`);
}

// 운영 환경에서는 반드시 강력한 랜덤 토큰으로 교체하고, 가능하면 내부망으로 추가 제한할 것.
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "관리자 인증이 필요합니다." });
  }
  next();
}

module.exports = { requireAdmin, ADMIN_TOKEN, ADMIN_ID, ADMIN_PASSWORD };
