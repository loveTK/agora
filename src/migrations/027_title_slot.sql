-- 레벨업 칭호를 표시할 'title' 아이템 슬롯 추가 — 기존 아이템/인벤토리 체계를 그대로 재사용한다.
-- CHECK 제약 변경이라 테이블을 재생성한다(020/021/024와 동일 패턴).
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE items RENAME TO items_old_027;

CREATE TABLE items (
  id                TEXT PRIMARY KEY,
  creator_id        TEXT REFERENCES users(id),
  owner_type        TEXT NOT NULL CHECK (owner_type IN ('religion', 'party', 'dominance', 'system', 'shop')),
  owner_id          TEXT,
  slot_type         TEXT NOT NULL CHECK (slot_type IN (
                      'accessory', 'badge', 'cloak', 'weapon',
                      'hat', 'face', 'top', 'pants', 'shoes', 'shield', 'jewelry', 'glasses', 'effect', 'background',
                      'title'
                    )),
  name              TEXT,
  price             INTEGER NOT NULL DEFAULT 0,
  design_asset_url  TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'free' CHECK (payment_status IN ('pending', 'paid', 'free')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO items (id, creator_id, owner_type, owner_id, slot_type, name, price, design_asset_url, payment_status, created_at)
SELECT id, creator_id, owner_type, owner_id, slot_type, name, price, design_asset_url, payment_status, created_at FROM items_old_027;

DROP TABLE items_old_027;

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;

-- 레벨 1~7 칭호를 시스템 아이템으로 시드(owner_type='system' = 착용 조건 없음).
-- services/experience.js의 grantXp()가 레벨업 시점에 자동으로 지급 + 착용시킨다.
INSERT INTO items (id, owner_type, slot_type, name, price, payment_status) VALUES
  ('title_lv1', 'system', 'title', '풋내기 시민',     0, 'free'),
  ('title_lv2', 'system', 'title', '떠오르는 목소리', 0, 'free'),
  ('title_lv3', 'system', 'title', '논객',            0, 'free'),
  ('title_lv4', 'system', 'title', '설득의 달인',     0, 'free'),
  ('title_lv5', 'system', 'title', '광장의 웅변가',   0, 'free'),
  ('title_lv6', 'system', 'title', '여론의 지휘자',   0, 'free'),
  ('title_lv7', 'system', 'title', '아고라의 현자',   0, 'free');
