-- 지도 자유 게시(맵 핀) 기능. 반응 3종은 기존 UI 표기 그대로 추천/비추천/바보를 쓰되,
-- votes.js처럼 유저당 게시글당 활성 반응을 하나만 유지하는 단일 테이블로 둔다(추천/비추천/바보 상호 배타).
CREATE TABLE map_posts (
  id           TEXT PRIMARY KEY,
  author_id    TEXT NOT NULL REFERENCES users(id),
  lat          REAL NOT NULL,
  lng          REAL NOT NULL,
  body         TEXT NOT NULL,
  upvotes      INTEGER NOT NULL DEFAULT 0,
  downvotes    INTEGER NOT NULL DEFAULT 0,
  fool_votes   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_map_posts_created ON map_posts(created_at);

CREATE TABLE map_post_votes (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES map_posts(id),
  voter_id    TEXT NOT NULL REFERENCES users(id),
  vote_type   TEXT NOT NULL CHECK (vote_type IN ('up', 'down', 'fool')),
  weight      REAL NOT NULL DEFAULT 1.0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, voter_id)
);

-- 바보 반응 누적 점수. 19장 티커 도감의 "이그지니어스" 자동 발급 조건 중 하나로 재사용한다
-- (임계치는 services/foolTicker.js). 논제/논증 쪽의 기존 이그지니어스(웃기다 반응 합산,
-- ingeniousTicker.js)와는 별개 경로지만 같은 티커를 발급한다.
ALTER TABLE users ADD COLUMN fool_score INTEGER NOT NULL DEFAULT 0;

-- user_tickers.source_type CHECK에 'user'를 추가한다. 바보 반응 누적은 게시물 한 건이 아니라
-- 유저 본인이 소스이므로 기존 'thread'/'argument'만 허용하던 CHECK로는 못 담는다.
-- CHECK 제약 변경이므로 008/014/017/020/021/024와 동일한 재생성 패턴을 쓴다.
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE user_tickers RENAME TO user_tickers_old_030;

CREATE TABLE user_tickers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  ticker        TEXT NOT NULL,
  source_type   TEXT CHECK (source_type IN ('thread', 'argument', 'user')),
  source_id     TEXT,
  granted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, ticker, source_type, source_id)
);

INSERT INTO user_tickers (id, user_id, ticker, source_type, source_id, granted_at)
SELECT id, user_id, ticker, source_type, source_id, granted_at FROM user_tickers_old_030;

DROP TABLE user_tickers_old_030;

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
