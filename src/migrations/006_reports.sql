-- AGORA S5: 신고, 콘텐츠 필터, 숨김 처리

ALTER TABLE threads ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE arguments ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- 금칙어 목록. 실제 서비스에서는 CX/법무 검토를 거친 진짜 목록으로 교체해야 한다.
-- 여기서는 필터 '메커니즘'을 시연하기 위한 자리표시자(placeholder) 단어만 넣는다.
CREATE TABLE IF NOT EXISTS banned_words (
  id          TEXT PRIMARY KEY,
  word        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL DEFAULT 'general',  -- hate | spam | general 등
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument', 'user')),
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewer_note TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
