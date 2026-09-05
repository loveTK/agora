-- AGORA S11: 군대/전쟁 시스템 1 (선전포고 + 수락 투표 + 병력 환산)
-- 실제 전투(진영 선택형 논쟁)와 영토 흡수는 S12에서 다룬다. 이번 스프린트는
-- "선포할 수 있는가 / 그 지역이 응할 것인가"까지만 처리한다.

-- 회피(부결) 시 시민에게 부여되는 "굴복 상태" — 이 기간 동안 그 지역 지배자는 명성 획득이 막힌다.
ALTER TABLE regions ADD COLUMN submission_until TEXT;

CREATE TABLE IF NOT EXISTS wars (
  id                  TEXT PRIMARY KEY,
  attacker_region_id  TEXT NOT NULL REFERENCES regions(id),
  defender_region_id  TEXT NOT NULL REFERENCES regions(id),
  declared_by         TEXT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'voting'
    CHECK (status IN ('voting', 'accepted', 'avoided', 'void')),
  -- voting: 수락투표 진행중 / accepted: 개전(S12에서 실제 전투 처리) / avoided: 회피(부결) / void: 정족수 미달 무효
  vote_deadline       TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at         TEXT
);

CREATE TABLE IF NOT EXISTS war_votes (
  id            TEXT PRIMARY KEY,
  war_id        TEXT NOT NULL REFERENCES wars(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  verdict       TEXT NOT NULL CHECK (verdict IN ('accept', 'reject')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (war_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_wars_attacker ON wars(attacker_region_id);
CREATE INDEX IF NOT EXISTS idx_wars_defender ON wars(defender_region_id);
CREATE INDEX IF NOT EXISTS idx_war_votes_war ON war_votes(war_id);
