-- AGORA S7: 처형 연출 트리거 + 명예의 전당 기반 스키마

-- 환생 쿨다운: 처형된 유저는 해당 지역에서 일정 기간 지배자 후보 자격을 박탈당한다.
ALTER TABLE dominance_candidates ADD COLUMN cooldown_until TEXT;

-- 지배자 재위 기록 (명예의 전당용 영구 보존 로그).
-- 등극 시 ended_at=NULL로 기록되고, 처형되면 ended_at/ended_reason이 채워진다.
CREATE TABLE IF NOT EXISTS dominance_history (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL REFERENCES regions(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  streak_days   INTEGER NOT NULL,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at      TEXT,
  ended_reason  TEXT CHECK (ended_reason IN ('executed'))
);

CREATE INDEX IF NOT EXISTS idx_dominance_history_region ON dominance_history(region_id);
