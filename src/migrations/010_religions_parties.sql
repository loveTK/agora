-- AGORA S8: 팔로우, 종교, 정당

-- 정당 창설 조건(팔로워 수)의 선행 요구사항이라 이번 스프린트에서 함께 구현한다.
CREATE TABLE IF NOT EXISTS follows (
  id            TEXT PRIMARY KEY,
  follower_id   TEXT NOT NULL REFERENCES users(id),
  followee_id   TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS religions (
  id            TEXT PRIMARY KEY,
  founder_id    TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 교리: 창설자가 지정한 논제 3~5개 묶음
CREATE TABLE IF NOT EXISTS religion_tenets (
  id            TEXT PRIMARY KEY,
  religion_id   TEXT NOT NULL REFERENCES religions(id),
  thread_id     TEXT NOT NULL REFERENCES threads(id)
);

-- 1인 1종교 (user_id UNIQUE) — 가입 시 기존 소속은 탈퇴 처리 후 새로 가입한다.
CREATE TABLE IF NOT EXISTS religion_members (
  id            TEXT PRIMARY KEY,
  religion_id   TEXT NOT NULL REFERENCES religions(id),
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  joined_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parties (
  id            TEXT PRIMARY KEY,
  founder_id    TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL UNIQUE,
  platform      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1인 1정당 (user_id UNIQUE)
CREATE TABLE IF NOT EXISTS party_members (
  id            TEXT PRIMARY KEY,
  party_id      TEXT NOT NULL REFERENCES parties(id),
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  joined_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
