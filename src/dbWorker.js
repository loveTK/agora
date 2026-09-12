// db.js의 워커 쪽. pg 커넥션 하나로 쿼리를 직렬 실행하고 결과를 MessagePort로 돌려준 뒤 Atomics로 깨운다.
const { workerData } = require("worker_threads");
const { Client, types } = require("pg");

// better-sqlite3가 돌려주던 형태에 맞춘다: COUNT/SUM은 숫자, 타임스탬프는 'YYYY-MM-DD HH:MM:SS' 문자열.
types.setTypeParser(20, Number);   // int8
types.setTypeParser(1700, Number); // numeric
types.setTypeParser(1114, (s) => s.slice(0, 19)); // timestamp
types.setTypeParser(1184, (s) => s.slice(0, 19)); // timestamptz — now() 계열. 세션 TZ가 UTC라 문자열 그대로 UTC
types.setTypeParser(1082, (s) => s); // date

const { port, shared, url } = workerData;
const flag = new Int32Array(shared);
const client = new Client({ connectionString: url });

// '?' → $1, $2 … (따옴표 안은 건드리지 않는다). INSERT OR IGNORE → ON CONFLICT DO NOTHING.
function toPg(sql) {
  if (/^\s*INSERT OR IGNORE\b/i.test(sql)) sql = sql.replace(/^\s*INSERT OR IGNORE/i, "INSERT") + " ON CONFLICT DO NOTHING";
  let n = 0, out = "", quote = null;
  for (const c of sql) {
    if (quote) { out += c; if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; out += c; continue; }
    out += c === "?" ? `$${++n}` : c;
  }
  return out;
}

(async () => {
  await client.connect();
  await client.query("SET TIME ZONE 'UTC'");
  port.on("message", async ({ sql, params }) => {
    let reply;
    try {
      const r = params ? await client.query(toPg(sql), params) : await client.query(sql);
      reply = { rows: r.rows || [], changes: r.rowCount || 0 };
    } catch (e) {
      reply = { error: { message: e.message, code: e.code, detail: e.detail } };
    }
    port.postMessage(reply);
    Atomics.store(flag, 0, 1);
    Atomics.notify(flag, 0);
  });
  port.postMessage({ ready: true });
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
})().catch((e) => {
  port.postMessage({ error: { message: e.message, code: e.code } });
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
});
