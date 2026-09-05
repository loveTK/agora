-- AGORA S6: 계급 승급(선지자 슬롯) + 지배자(7일 무패) 시스템

-- 지역별 '무패 연속일수' 추적용. 지배자가 되기 전 단계의 후보 상태를 담는다.
CREATE TABLE IF NOT EXISTS dominance_candidates (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  region_id          TEXT NOT NULL REFERENCES regions(id),
  streak_days        INTEGER NOT NULL DEFAULT 0,
  last_counted_date  TEXT NOT NULL DEFAULT (date('now')),
  UNIQUE (user_id, region_id)
);

-- 지역당 지배자는 1명 (region_id UNIQUE). status는 향후 폭군 전환(S7 이후) 대비 미리 열어둠.
CREATE TABLE IF NOT EXISTS dominance (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL UNIQUE REFERENCES regions(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'ruler' CHECK (status IN ('ruler', 'tyrant')),
  streak_days   INTEGER NOT NULL DEFAULT 7,
  started_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
