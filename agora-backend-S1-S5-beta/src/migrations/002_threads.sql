-- AGORA S2: 논제(threads), 논증(arguments) 테이블

CREATE TABLE IF NOT EXISTS threads (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL REFERENCES regions(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  body          TEXT,
  status        TEXT NOT NULL DEFAULT 'active'   -- active | collapsed | settled
    CHECK (status IN ('active', 'collapsed', 'settled')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_threads_region ON threads(region_id);
CREATE INDEX IF NOT EXISTS idx_threads_author_created ON threads(author_id, created_at);

CREATE TABLE IF NOT EXISTS arguments (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  stance        TEXT NOT NULL CHECK (stance IN ('pro', 'con')),
  body          TEXT NOT NULL,
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_arguments_thread ON arguments(thread_id);
