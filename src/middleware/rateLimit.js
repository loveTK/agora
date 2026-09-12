// ponytail: 프로세스 메모리 고정창. PM2 instances>1 되면 Redis로.
function rateLimit({ max, windowMs }) {
  const buckets = new Map(); // 리미터마다 별도 창 — 라우트 간 카운트 공유 안 함
  return (req, res, next) => {
    const now = Date.now();
    const b = buckets.get(req.ip);
    if (!b || now - b.at > windowMs) {
      buckets.set(req.ip, { at: now, n: 1 });
      return next();
    }
    if (++b.n > max) return res.status(429).json({ error: "잠시 후 다시 시도하세요." });
    next();
  };
}

module.exports = { rateLimit };

if (require.main === module) {
  const assert = require("assert");
  const mw = rateLimit({ max: 3, windowMs: 50 });
  const hit = () => {
    let code = 200;
    mw({ ip: "1.1.1.1" }, { status: (c) => ({ json: () => (code = c) }) }, () => {});
    return code;
  };
  assert.deepStrictEqual([hit(), hit(), hit(), hit()], [200, 200, 200, 429]);
  setTimeout(() => { assert.strictEqual(hit(), 200); console.log("rateLimit ok"); }, 60);
}
