-- AGORA: "웃기다" 반응 + 티커(도감) 자동 발급 기반 테이블

-- weight는 votes 테이블과 동일한 신규 계정 가중치(voteWeight.js)를 그대로 적용한 값 —
-- "이그지니어스" 임계값(50)도 건수가 아니라 가중치 합산으로 판정한다(어뷰징 방지 원칙 재사용).
CREATE TABLE IF NOT EXISTS laugh_reactions (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument')),
  target_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id),
  weight        REAL NOT NULL DEFAULT 1.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (target_type, target_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_laugh_reactions_target ON laugh_reactions(target_type, target_id);

-- 19장 티커 도감의 자동 발급 티커를 기록한다(수동 부여 티커는 21장 관리자 페이지 몫 — 별도).
CREATE TABLE IF NOT EXISTS user_tickers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  ticker        TEXT NOT NULL,
  source_type   TEXT CHECK (source_type IN ('thread', 'argument')),
  source_id     TEXT,
  granted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, ticker, source_type, source_id)
);
