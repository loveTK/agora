-- 상점(20장) 첫 착수분: 이름/가격 컬럼 추가 + 슬롯 종류 확장(모자/얼굴/상의/바지/신발/방패/장신구/안경/이펙트/배경)
-- + owner_type에 'shop'(누구 소유도 아닌 상점 판매용 카탈로그 아이템) 추가.
-- CHECK 제약 변경이라 테이블을 재생성한다(008/014/017/020과 동일 패턴).
PRAGMA foreign_keys=OFF;
PRAGMA legacy_alter_table=ON;

ALTER TABLE items RENAME TO items_old_021;

CREATE TABLE items (
  id                TEXT PRIMARY KEY,
  creator_id        TEXT REFERENCES users(id),
  owner_type        TEXT NOT NULL CHECK (owner_type IN ('religion', 'party', 'dominance', 'system', 'shop')),
  owner_id          TEXT,
  slot_type         TEXT NOT NULL CHECK (slot_type IN (
                      'accessory', 'badge', 'cloak', 'weapon',
                      'hat', 'face', 'top', 'pants', 'shoes', 'shield', 'jewelry', 'glasses', 'effect', 'background'
                    )),
  name              TEXT,
  price             INTEGER NOT NULL DEFAULT 0,
  design_asset_url  TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'free' CHECK (payment_status IN ('pending', 'paid', 'free')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO items (id, creator_id, owner_type, owner_id, slot_type, design_asset_url, payment_status, created_at)
SELECT id, creator_id, owner_type, owner_id, slot_type, design_asset_url, payment_status, created_at FROM items_old_021;

DROP TABLE items_old_021;

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;

-- 상점 시드: 가격 0원, 착용 조건 없음(owner_type='shop'이라 종교/정당/지배자 소속 검증 대상이 아님) — 10종.
-- 실제 그림은 프론트(agora.html)의 인라인 SVG로 그린다(이 프로젝트는 이미지 업로드/호스팅이 없음 — 기존 아바타/아이콘도 전부 인라인 SVG).
INSERT INTO items (id, owner_type, slot_type, name, price, payment_status) VALUES
  ('shop_hat_laurel',     'shop', 'hat',        '월계관',       0, 'free'),
  ('shop_face_beard',     'shop', 'face',       '철학자 수염',   0, 'free'),
  ('shop_top_chiton',     'shop', 'top',        '키톤',         0, 'free'),
  ('shop_pants_greaves',  'shop', 'pants',      '가죽 각반',     0, 'free'),
  ('shop_shoes_sandal',   'shop', 'shoes',      '가죽 샌들',     0, 'free'),
  ('shop_shield_hoplon',  'shop', 'shield',     '호플론 방패',   0, 'free'),
  ('shop_jewelry_olive',  'shop', 'jewelry',    '올리브 브로치', 0, 'free'),
  ('shop_glasses_round',  'shop', 'glasses',    '둥근테 안경',   0, 'free'),
  ('shop_effect_halo',    'shop', 'effect',     '빛무리',       0, 'free'),
  ('shop_background_columns', 'shop', 'background', '기둥 배경', 0, 'free');
