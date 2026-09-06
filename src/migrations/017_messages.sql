-- AGORA: 유저간 쪽지(DM)
-- threads/arguments와 동일하게 hidden 플래그를 둬서 신고 자동숨김(reports)에 그대로 태울 수 있게 한다.
CREATE TABLE IF NOT EXISTS messages (
  id            TEXT PRIMARY KEY,
  sender_id     TEXT NOT NULL REFERENCES users(id),
  receiver_id   TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0,
  read_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

-- reports.target_type CHECK에 'message'를 추가하기 위해 테이블을 재생성한다.
-- (008/014 마이그레이션과 동일한 이유로 legacy_alter_table을 켜서 FK 참조가 깨지지 않게 한다.)
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE reports RENAME TO reports_old_017;

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument', 'user', 'message')),
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewer_note TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at   TEXT
);

INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, reviewer_note, created_at, reviewed_at)
SELECT id, reporter_id, target_type, target_id, reason, status, reviewer_note, created_at, reviewed_at FROM reports_old_017;

DROP TABLE reports_old_017;

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
