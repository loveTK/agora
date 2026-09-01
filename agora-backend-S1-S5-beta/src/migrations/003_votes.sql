-- AGORA S3: 추천/비추천(votes), 판정투표(judgment_votes), 판정결과(judgments)

CREATE TABLE IF NOT EXISTS votes (
  id            TEXT PRIMARY KEY,
  argument_id   TEXT NOT NULL REFERENCES arguments(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (argument_id, voter_id)   -- 1계정 1논증 1표
);

CREATE TABLE IF NOT EXISTS judgment_votes (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  verdict       TEXT NOT NULL CHECK (verdict IN ('approve', 'collapse')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (thread_id, voter_id)     -- 1계정 1논제 1표 (판정투표)
);

CREATE TABLE IF NOT EXISTS judgments (
  id               TEXT PRIMARY KEY,
  thread_id        TEXT NOT NULL REFERENCES threads(id),
  approve_votes    INTEGER NOT NULL,
  collapse_votes   INTEGER NOT NULL,
  participant_count INTEGER NOT NULL,
  verdict          TEXT NOT NULL CHECK (verdict IN ('collapse')),  -- 붕괴 확정된 건만 기록
  resolved_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_votes_argument ON votes(argument_id);
CREATE INDEX IF NOT EXISTS idx_jvotes_thread ON judgment_votes(thread_id);
