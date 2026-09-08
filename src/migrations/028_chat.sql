-- AGORA: 홈 화면 공개 라이브 채팅.
CREATE TABLE IF NOT EXISTS chat_messages (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- reports.target_type CHECK에 'chat_message' 추가 — 017/020/021/024와 동일한 재생성 패턴.
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE reports RENAME TO reports_old_028;

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument', 'user', 'message', 'chat_message')),
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewer_note TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at   TEXT
);

INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, reviewer_note, created_at, reviewed_at)
SELECT id, reporter_id, target_type, target_id, reason, status, reviewer_note, created_at, reviewed_at FROM reports_old_028;

DROP TABLE reports_old_028;

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
