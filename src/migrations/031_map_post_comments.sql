-- 지도 게시글(맵 핀) 댓글. 논증 답글(023_argument_replies.sql)과 같은 구조를 따르되,
-- 맵 핀은 팝업에서 짧게 주고받는 용도라 대댓글/반응 없이 한 단계만 둔다.
CREATE TABLE IF NOT EXISTS map_post_comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES map_posts(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_map_post_comments_post ON map_post_comments(post_id, created_at);
