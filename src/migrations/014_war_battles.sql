-- AGORA S12: 군대/전쟁 시스템 2 (실전투 + 영토 점령)

ALTER TABLE regions ADD COLUMN occupied_until TEXT;    -- 점령 상태 지속 기간(7일)
ALTER TABLE regions ADD COLUMN thread_ban_until TEXT;  -- 점령 중 신규 논제 등록 제한(3일, occupied보다 짧음)

-- 전쟁의 실제 전투: "진영 선택형 논쟁". 선택지는 항상 공격측 주장/방어측 주장 2개로 고정한다
-- (핫 아젠다의 "기타" 옵션 같은 자유 선택지는 전쟁 승패 판정의 모호함을 피하기 위해 두지 않는다).
CREATE TABLE IF NOT EXISTS war_battles (
  id                TEXT PRIMARY KEY,
  war_id            TEXT NOT NULL UNIQUE REFERENCES wars(id),
  title             TEXT NOT NULL,
  option_attacker   TEXT NOT NULL,
  option_defender   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  deadline          TEXT NOT NULL,
  winner_side       TEXT CHECK (winner_side IN ('attacker', 'defender')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  settled_at        TEXT
);

-- 진영 선택은 개표 전까지 비공개(동조 쏠림 방지) — API 응답에서 status='open'인 동안 노출하지 않는다.
CREATE TABLE IF NOT EXISTS war_battle_choices (
  id            TEXT PRIMARY KEY,
  battle_id     TEXT NOT NULL REFERENCES war_battles(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  side          TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (battle_id, user_id)
);

CREATE TABLE IF NOT EXISTS war_battle_arguments (
  id            TEXT PRIMARY KEY,
  battle_id     TEXT NOT NULL REFERENCES war_battles(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  side          TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  body          TEXT NOT NULL,
  upvotes       INTEGER NOT NULL DEFAULT 0,
  downvotes     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS war_battle_votes (
  id            TEXT PRIMARY KEY,
  argument_id   TEXT NOT NULL REFERENCES war_battle_arguments(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (argument_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_war_battle_args_battle ON war_battle_arguments(battle_id);

-- dominance_history.ended_reason에 'conquered'(전쟁 패배로 인한 실각)를 추가하기 위해 테이블을 재생성한다.
-- (008 마이그레이션과 동일한 이유로 legacy_alter_table을 켜서 다른 테이블의 FK 참조가 깨지지 않게 한다.)
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE dominance_history RENAME TO dominance_history_old_014;

CREATE TABLE dominance_history (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL REFERENCES regions(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  streak_days   INTEGER NOT NULL,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at      TEXT,
  ended_reason  TEXT CHECK (ended_reason IN ('executed', 'conquered'))
);

INSERT INTO dominance_history (id, region_id, user_id, streak_days, started_at, ended_at, ended_reason)
SELECT id, region_id, user_id, streak_days, started_at, ended_at, ended_reason FROM dominance_history_old_014;

DROP TABLE dominance_history_old_014;

CREATE INDEX IF NOT EXISTS idx_dominance_history_region ON dominance_history(region_id);

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
