-- 논제가 항상 찬성/반대 이분법으로 안 나뉘는 경우가 있어 논증 입장(stance)에 '기타'를 추가한다.
-- CHECK 제약 변경이라 테이블을 재생성한다(008/014/017과 동일 패턴, FK 참조 보존을 위해 legacy_alter_table 사용).
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE arguments RENAME TO arguments_old_020;

CREATE TABLE arguments (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  stance        TEXT NOT NULL CHECK (stance IN ('pro', 'con', 'other')),
  body          TEXT NOT NULL,
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  hidden        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO arguments (id, thread_id, author_id, stance, body, upvotes, downvotes, hidden, created_at)
SELECT id, thread_id, author_id, stance, body, upvotes, downvotes, hidden, created_at FROM arguments_old_020;

DROP TABLE arguments_old_020;

CREATE INDEX IF NOT EXISTS idx_arguments_thread ON arguments(thread_id);

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
