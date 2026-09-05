-- AGORA S6 확장: 용어 정리 + 호전성/폭군 시스템 기반 컬럼
-- - rank 값 'follower' -> 'supporter' (기획 확정: 계급명 "지지자"의 내부 키를 팔로우 기능과 구분)
-- - belligerence: 호전성 게이지 (발의 +2, 답글 +1로 적립 — 다작 논객 랭킹과 통합, 별도 축 없음)
-- - downvotes_received: 폭군 판정용 누적 비추천 수 (지배자에 한해 임계값 초과 시 dominance.status가 tyrant로 전환)
--
-- SQLite는 CHECK 제약조건을 직접 수정할 수 없어 테이블을 재생성한다.

PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;
-- legacy_alter_table이 없으면 SQLite가 RENAME TABLE 시 다른 테이블(threads, arguments 등)의
-- REFERENCES users(id) 구문까지 자동으로 REFERENCES users_old_008(id)로 고쳐버려서,
-- 이후 users_old_008을 DROP하는 순간 나머지 테이블들이 존재하지 않는 테이블을 참조하게 된다.

ALTER TABLE users RENAME TO users_old_008;

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  nickname            TEXT NOT NULL,
  region_id           TEXT NOT NULL REFERENCES regions(id),
  rank                TEXT NOT NULL DEFAULT 'citizen'
    CHECK (rank IN ('citizen', 'supporter', 'prophet')),
  region_changed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  reputation          INTEGER NOT NULL DEFAULT 0,
  signup_ip           TEXT,
  belligerence        INTEGER NOT NULL DEFAULT 0,
  downvotes_received  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO users (
  id, email, password_hash, nickname, region_id, rank,
  region_changed_at, created_at, reputation, signup_ip, belligerence, downvotes_received
)
SELECT
  id, email, password_hash, nickname, region_id,
  CASE WHEN rank = 'follower' THEN 'supporter' ELSE rank END,
  region_changed_at, created_at, reputation, signup_ip, 0, 0
FROM users_old_008;

DROP TABLE users_old_008;

CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
