-- AGORA: Hot Issue 카드에서 바로 반응할 수 있는 논제(thread) 단위 추천/비추천.
-- 기존 논증(argument) 추천/비추천(votes 테이블)과는 성격이 다르다 — 명성/계급/폭군 판정에
-- 영향을 주는 게 아니라 순수 참여도 집계용이라 별도 테이블로 둔다(기획 요청: "참여 카운트 증가").
CREATE TABLE IF NOT EXISTS thread_votes (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  weight        REAL NOT NULL DEFAULT 1.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (thread_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_thread_votes_thread ON thread_votes(thread_id);
