// SQLite → PostgreSQL 1회 이전. 사용: node scripts/sqlite-to-pg.js data/agora.db (.env의 DATABASE_URL 사용)
// PG 쪽은 마이그레이션만 적용된 빈 DB여야 한다(기존 행이 있으면 ON CONFLICT DO NOTHING으로 건너뜀).
require("dotenv").config({ quiet: true }); // index.js/seed.js와 동일 — 이게 없으면 .env를 안 읽어 DATABASE_URL이 빈 채로 db.js가 죽는다
const path = require("path");
const src = process.argv[2];
if (!src) { console.error("사용: node scripts/sqlite-to-pg.js <agora.db>"); process.exit(1); }

const sqlite = require("better-sqlite3")(path.resolve(src), { readonly: true });
const { db, runMigrations } = require("../src/db");
runMigrations();

// FK 부모 → 자식 순서(위상정렬)
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'").all().map((r) => r.name);
const deps = Object.fromEntries(tables.map((t) => [t, sqlite.prepare(`PRAGMA foreign_key_list(${t})`).all().map((f) => f.table).filter((p) => p !== t)]));
const order = [];
const seen = new Set();
const visit = (t) => { if (seen.has(t)) return; seen.add(t); for (const d of deps[t] || []) visit(d); order.push(t); };
tables.forEach(visit);

let total = 0;
for (const t of order) {
  const rows = sqlite.prepare(`SELECT * FROM ${t}`).all();
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  const sql = `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT DO NOTHING`;
  const insert = db.prepare(sql);
  try {
    db.transaction(() => { for (const r of rows) insert.run(...cols.map((c) => r[c])); })();
  } catch (e) {
    console.error(`${t}: 실패 — ${e.message}`);
    process.exit(1);
  }
  const pgCount = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
  console.log(`${t}: sqlite ${rows.length} → pg ${pgCount}${pgCount < rows.length ? "  ← 부족" : ""}`);
  total += rows.length;
}
console.log(`완료: ${order.length}개 테이블, ${total}행`);
process.exit(0);
