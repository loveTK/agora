-- AGORA S9: 아이템 슬롯 + 결제(모의) 시스템

-- owner_type에 따라 owner_id가 가리키는 대상이 다르다(폴리모픽):
--   religion -> religions.id / party -> parties.id / dominance -> regions.id / system -> NULL
-- SQLite는 폴리모픽 FK를 지원하지 않으므로 owner_id에는 FK 제약을 걸지 않는다(의도적).
CREATE TABLE IF NOT EXISTS items (
  id                TEXT PRIMARY KEY,
  creator_id        TEXT REFERENCES users(id),  -- system 발급 아이템은 NULL(운영팀 발급이 아닌 시스템 프리셋)
  owner_type        TEXT NOT NULL CHECK (owner_type IN ('religion', 'party', 'dominance', 'system')),
  owner_id          TEXT,
  slot_type         TEXT NOT NULL CHECK (slot_type IN ('accessory', 'badge', 'cloak', 'weapon')),
  design_asset_url  TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'free' CHECK (payment_status IN ('pending', 'paid', 'free')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_inventory (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  item_id       TEXT NOT NULL REFERENCES items(id),
  acquired_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, item_id)
);

-- 실제 PG(결제대행사) 연동 전까지 쓰는 모의 결제 세션.
-- 운영 전환 시 이 테이블 + /internal/payments/:sessionId/confirm 부분만 실제 PG 웹훅으로 교체하면 된다.
CREATE TABLE IF NOT EXISTS payment_sessions (
  id            TEXT PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES items(id),
  amount        INTEGER NOT NULL DEFAULT 15000,
  status        TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'confirmed', 'failed')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at  TEXT
);
