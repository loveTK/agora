-- AGORA S13: 문화 루트(사상 전파) — 핫 아젠다 대시보드 + 영향력(Influence) 시스템

-- 유저가 타 지역에서 쌓은 영향력. 자기 소속 지역은 대상에서 제외한다(자국 활동은 명성/호전성으로 이미 보상됨).
CREATE TABLE IF NOT EXISTS influence (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  region_id     TEXT NOT NULL REFERENCES regions(id),
  points        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, region_id)
);

-- 특정 유저가 특정 타 지역에서 영향력 임계치를 넘겨 "사상 영향권"으로 인정된 기록.
-- (한 번 도달하면 영구 보존 — 이후 영향력이 줄어도 이 기록 자체는 유지한다)
CREATE TABLE IF NOT EXISTS cultural_influence_zones (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  foreign_region_id TEXT NOT NULL REFERENCES regions(id),
  achieved_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, foreign_region_id)
);

-- 사상 영향권 5곳 달성 시 "문화 승리" 업적 기록 (1인 1회).
-- 실제 버전(시즌) 전환 등 세계 지배 효과는 아직 미구현(문서 14장 버전 시스템 선행 필요) — 이 테이블은
-- 달성 사실 자체를 영구 기록해두는 용도다.
CREATE TABLE IF NOT EXISTS culture_victories (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  home_region_id TEXT NOT NULL REFERENCES regions(id),
  achieved_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
