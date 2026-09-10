-- AGORA V3: 동단위 정복 MVP. 기존 V2 홈페이지(지역/논제/투표 등)와는 완전히 분리된 별도 레이어다.
-- 실제 행정동 GIS 경계 데이터는 이 단계에서 쓰지 않는다 — 도시(regions)마다 손으로 큐레이션한
-- 동 5~8개만 둔다. GPS/위치 인증도 쓰지 않으므로 위치 개인정보는 전혀 수집하지 않는다.
-- (나중에 실제 GIS/위치 기반 기능을 붙일 때는 별도로 개인정보 처리방침 검토가 필요하다.)

CREATE TABLE IF NOT EXISTS neighborhoods (
  id                TEXT PRIMARY KEY,
  parent_region_id  TEXT NOT NULL REFERENCES regions(id),
  name              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'npc' CHECK (status IN ('npc', 'contested', 'dominant')),
  npc_difficulty    INTEGER NOT NULL DEFAULT 30,
  dominant_user_id  TEXT REFERENCES users(id),
  -- 실제 GIS 좌표가 아니라 지도에 점을 찍기 위한 장식용 좌표(부모 지역 좌표 근처에 임의로 흩뿌림).
  lat               REAL,
  lng               REAL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (parent_region_id, name)
);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_region ON neighborhoods(parent_region_id);

-- 인접 관계는 양방향 수동 등록(대칭 쌍으로 삽입) — 공격 시 서버가 이 테이블로 재검증한다.
CREATE TABLE IF NOT EXISTS neighborhood_adjacency (
  neighborhood_id           TEXT NOT NULL REFERENCES neighborhoods(id),
  adjacent_neighborhood_id  TEXT NOT NULL REFERENCES neighborhoods(id),
  PRIMARY KEY (neighborhood_id, adjacent_neighborhood_id)
);

-- 시민 기여 기록 — 정복력의 실질 데이터. 지배자 개인이 아니라 이 테이블의 합산이 정복력이다(기획 3절).
CREATE TABLE IF NOT EXISTS neighborhood_contributions (
  id              TEXT PRIMARY KEY,
  neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  points          INTEGER NOT NULL,
  ip              TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_neighborhood_contrib_neighborhood ON neighborhood_contributions(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_contrib_user ON neighborhood_contributions(user_id);

-- 재탈환용 저항 포인트 — 정복당한 동의 과거 지배 세력 소속 유저에게 부여(기획 3절 레지스탕스 메커니즘).
CREATE TABLE IF NOT EXISTS neighborhood_resistance (
  id              TEXT PRIMARY KEY,
  neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  points          INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_neighborhood_resist_lookup ON neighborhood_resistance(neighborhood_id, user_id);

-- 시즌 시작/종료 — 8주 주기(services/neighborhoodConquest.js의 SEASON_WEEKS 상수로 관리).
CREATE TABLE IF NOT EXISTS neighborhood_seasons (
  id          TEXT PRIMARY KEY,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at    TEXT
);

-- 시즌 종료 시 리셋되는 값(지배권/기여/저항)과 분리해 영구 보존하는 챔피언 아카이브.
-- 기존 dominance_history(009_execution.sql) 패턴 재사용.
CREATE TABLE IF NOT EXISTS neighborhood_season_champions (
  id               TEXT PRIMARY KEY,
  season_id        TEXT NOT NULL REFERENCES neighborhood_seasons(id),
  neighborhood_id  TEXT NOT NULL REFERENCES neighborhoods(id),
  user_id          TEXT NOT NULL REFERENCES users(id),
  final_points     INTEGER NOT NULL,
  recorded_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 공격 시도 로그 — 일일 공격 횟수 제한 집계 + 감사 기록을 겸한다(성공/실패 모두 기록).
CREATE TABLE IF NOT EXISTS neighborhood_attacks (
  id                      TEXT PRIMARY KEY,
  target_neighborhood_id  TEXT NOT NULL REFERENCES neighborhoods(id),
  from_neighborhood_id    TEXT REFERENCES neighborhoods(id),
  attacker_id             TEXT NOT NULL REFERENCES users(id),
  attacker_power          INTEGER NOT NULL,
  defense_power           INTEGER NOT NULL,
  won                     INTEGER NOT NULL,
  insurrection            INTEGER NOT NULL DEFAULT 0,
  ip                      TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_neighborhood_attacks_attacker ON neighborhood_attacks(attacker_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_attacks_target ON neighborhood_attacks(target_neighborhood_id);

-- 창립자 타이틀 — 그 동을 최초로 NPC에서 해방시킨 유저(동 1개당 1행, 시즌이 몇 번을 돌아도
-- 절대 리셋/재기록되지 않는 영구 기록). INSERT OR IGNORE로 최초 1회만 남긴다.
CREATE TABLE IF NOT EXISTS neighborhood_founders (
  neighborhood_id  TEXT PRIMARY KEY REFERENCES neighborhoods(id),
  user_id          TEXT NOT NULL REFERENCES users(id),
  liberated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
