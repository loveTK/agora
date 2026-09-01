-- AGORA S4: 어뷰징 방지 1차
-- votes.weight: 신규 계정 가중치를 낮추기 위한 투표 가중치 (0~1)
-- users.signup_ip: 다중 계정 탐지용 가입 IP 기록
-- abuse_flags: 이상 패턴 자동 탐지 결과를 쌓아두는 로그 (관리자 검토용)

ALTER TABLE votes ADD COLUMN weight REAL NOT NULL DEFAULT 1.0;
ALTER TABLE users ADD COLUMN signup_ip TEXT;

CREATE TABLE IF NOT EXISTS abuse_flags (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,          -- 'signup_ip_burst' | 'vote_burst' 등
  user_id     TEXT REFERENCES users(id),
  detail      TEXT NOT NULL,          -- 사람이 읽을 수 있는 설명
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_abuse_flags_created ON abuse_flags(created_at);
