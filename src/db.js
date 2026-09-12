// PostgreSQL을 better-sqlite3와 같은 동기 API로 쓴다. pg는 워커 스레드(dbWorker.js)에서 돌고,
// 메인 스레드는 쿼리마다 Atomics.wait로 결과를 기다린다(synckit 방식). 라우트/서비스는
// db.prepare(sql).get/all/run 과 db.transaction(fn)만 쓰므로 그 둘만 제공한다.
// ponytail: 프로세스당 커넥션 1개, 쿼리 직렬 — SQLite 때와 같은 특성. 처리량은 PM2 instances로.
const fs = require("fs");
const path = require("path");
const { Worker, MessageChannel, receiveMessageOnPort } = require("worker_threads");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL env 필요 (.env.example 참고)");

const shared = new SharedArrayBuffer(4);
const flag = new Int32Array(shared);
const { port1, port2 } = new MessageChannel();
const worker = new Worker(path.join(__dirname, "dbWorker.js"), {
  workerData: { port: port2, shared, url: DATABASE_URL },
  transferList: [port2],
});
worker.unref();
port1.unref();

function call(sql, params) {
  Atomics.store(flag, 0, 0);
  port1.postMessage({ sql, params });
  Atomics.wait(flag, 0, 0);
  const { message } = receiveMessageOnPort(port1);
  if (message.error) {
    const e = new Error(message.error.message);
    e.code = message.error.code;
    e.detail = message.error.detail;
    throw e;
  }
  return message;
}

// 워커가 접속을 마칠 때까지 기다린다 — 첫 쿼리 전에 실패하면 바로 죽는 편이 낫다.
Atomics.wait(flag, 0, 0);
{
  const { message } = receiveMessageOnPort(port1);
  if (message.error) throw new Error(`PostgreSQL 접속 실패: ${message.error.message}`);
}

let depth = 0;
const db = {
  prepare(sql) {
    return {
      get: (...p) => call(sql, p).rows[0],
      all: (...p) => call(sql, p).rows,
      run: (...p) => ({ changes: call(sql, p).changes }),
    };
  },
  exec(sql) { call(sql); },
  transaction(fn) {
    return (...args) => {
      const sp = `sp${depth}`;
      call(depth ? `SAVEPOINT ${sp}` : "BEGIN");
      depth++;
      try {
        const out = fn(...args);
        depth--;
        call(depth ? `RELEASE SAVEPOINT ${sp}` : "COMMIT");
        return out;
      } catch (e) {
        depth--;
        call(depth ? `ROLLBACK TO SAVEPOINT ${sp}` : "ROLLBACK");
        throw e;
      }
    };
  },
};

function runMigrations() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT now())"
  );
  const dir = path.join(__dirname, "migrations", "pg");
  const applied = new Set(db.prepare("SELECT filename FROM schema_migrations").all().map((r) => r.filename));
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".sql") || applied.has(file)) continue;
    db.transaction(() => {
      db.exec(fs.readFileSync(path.join(dir, file), "utf8"));
      db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(file);
    })();
    console.log(`[migrate] applied ${file}`);
  }
}

module.exports = { db, runMigrations };

if (require.main === module) {
  const assert = require("assert");
  assert.deepStrictEqual(db.prepare("SELECT ?::int AS a, '?' AS q, ? AS b").get(1, "x"), { a: 1, q: "?", b: "x" });
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM (SELECT 1 UNION ALL SELECT 2) t").get().c, 2);
  db.exec("CREATE TEMP TABLE t_self (v INTEGER)");
  const outer = db.transaction(() => {
    db.prepare("INSERT INTO t_self VALUES (?)").run(1);
    try { db.transaction(() => { db.prepare("INSERT INTO t_self VALUES (?)").run(2); throw new Error("inner"); })(); } catch (e) { /* 안쪽만 롤백 */ }
    db.prepare("INSERT INTO t_self VALUES (?)").run(3);
  });
  outer();
  assert.deepStrictEqual(db.prepare("SELECT v FROM t_self ORDER BY v").all().map((r) => r.v), [1, 3]);
  assert.strictEqual(db.prepare("SELECT now()::timestamp AS t").get().t.length, 19);
  console.log("db ok");
  process.exit(0);
}
