-- AGORA S16: 국회(견제) 시스템
-- 국회력 = 지역 내 정당원 수 합산(party_members join users, 계산은 코드에서 처리 — 별도 테이블 불필요).
-- 국회력이 임계치(30명) 이상인 지역의 '지배자'(폭군 아님)가 선전포고하려면
-- 자기 지역 정당원 대상 승인 투표(24시간, 과반)를 먼저 통과해야 한다.
-- 폭군이거나 국회력이 임계치 미만이면 승인 절차 없이 바로 선포(기존 wars 플로우).

CREATE TABLE IF NOT EXISTS congress_approvals (
  id                  TEXT PRIMARY KEY,
  attacker_region_id  TEXT NOT NULL REFERENCES regions(id),
  defender_region_id  TEXT NOT NULL REFERENCES regions(id),
  declared_by         TEXT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'voting'
    CHECK (status IN ('voting', 'approved', 'rejected')),
  -- voting: 승인투표 진행중 / approved: 승인 → 실제 전쟁 선포됨 / rejected: 부결(페널티 없음, 선포만 무산)
  war_id              TEXT REFERENCES wars(id), -- 승인되면 실제로 생성된 전쟁 id를 채운다
  vote_deadline       TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at         TEXT
);

CREATE TABLE IF NOT EXISTS congress_votes (
  id            TEXT PRIMARY KEY,
  approval_id   TEXT NOT NULL REFERENCES congress_approvals(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  verdict       TEXT NOT NULL CHECK (verdict IN ('accept', 'reject')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (approval_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_congress_approvals_attacker ON congress_approvals(attacker_region_id);
CREATE INDEX IF NOT EXISTS idx_congress_votes_approval ON congress_votes(approval_id);
