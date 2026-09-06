-- "웃기다" 반응 대상에 대댓글(reply)도 추가한다(CHECK 제약 변경이라 테이블 재생성 — 020과 동일 패턴).
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE laugh_reactions RENAME TO laugh_reactions_old_024;

CREATE TABLE laugh_reactions (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument', 'reply')),
  target_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id),
  weight        REAL NOT NULL DEFAULT 1.0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (target_type, target_id, user_id)
);

INSERT INTO laugh_reactions (id, target_type, target_id, user_id, weight, created_at)
SELECT id, target_type, target_id, user_id, weight, created_at FROM laugh_reactions_old_024;

DROP TABLE laugh_reactions_old_024;

CREATE INDEX IF NOT EXISTS idx_laugh_reactions_target ON laugh_reactions(target_type, target_id);

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
