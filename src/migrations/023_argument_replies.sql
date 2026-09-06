-- 의견(논증)에 대댓글을 달 수 있게 하는 테이블.
CREATE TABLE IF NOT EXISTS argument_replies (
  id            TEXT PRIMARY KEY,
  argument_id   TEXT NOT NULL REFERENCES arguments(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_argument_replies_argument ON argument_replies(argument_id);

-- 대댓글 전용 추천/비추천 — thread_votes와 동일한 성격(참여도 집계용, 명성에는 영향 없음).
CREATE TABLE IF NOT EXISTS reply_votes (
  id            TEXT PRIMARY KEY,
  reply_id      TEXT NOT NULL REFERENCES argument_replies(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  weight        REAL NOT NULL DEFAULT 1.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reply_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_reply_votes_reply ON reply_votes(reply_id);
