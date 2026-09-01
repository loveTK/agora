const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

// 개발/베타 단계는 SQLite로 시작합니다.
// 운영 전환 시 이 파일만 pg(PostgreSQL) 드라이버로 교체하면 됩니다.
// (쿼리는 표준 SQL로 작성해 마이그레이션 부담을 최소화했습니다.)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "agora.db");
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

function runMigrations() {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );

  const migrationDir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(migrationDir).sort();
  const alreadyApplied = new Set(
    db.prepare("SELECT filename FROM schema_migrations").all().map((r) => r.filename)
  );

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    if (alreadyApplied.has(file)) continue; // 이미 적용된 마이그레이션은 다시 실행하지 않음 (ALTER TABLE 등은 재실행 시 에러)

    const sql = fs.readFileSync(path.join(migrationDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(file);
    console.log(`[migrate] applied ${file}`);
  }
}

module.exports = { db, runMigrations };
