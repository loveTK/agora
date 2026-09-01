-- AGORA S1: 코어 테이블 (REGIONS, USERS)

CREATE TABLE IF NOT EXISTS regions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'dispute'   -- dominant | contested | dispute
    CHECK (status IN ('dominant', 'contested', 'dispute')),
  lat           REAL,
  lng           REAL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  nickname          TEXT NOT NULL,
  region_id         TEXT NOT NULL REFERENCES regions(id),
  rank              TEXT NOT NULL DEFAULT 'citizen'  -- citizen | follower | prophet
    CHECK (rank IN ('citizen', 'follower', 'prophet')),
  region_changed_at TEXT NOT NULL DEFAULT (datetime('now')), -- 지역 이동 쿨다운 계산용
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);
