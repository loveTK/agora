-- 상점 아이템 10종(가격 0) + 레벨 1~7 칭호. SQLite 마이그레이션 021/027의 데이터 부분.
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
  ('shop_background_columns', 'shop', 'background', '기둥 배경', 0, 'free'),
  ('title_lv1', 'system', 'title', '풋내기 시민',     0, 'free'),
  ('title_lv2', 'system', 'title', '떠오르는 목소리', 0, 'free'),
  ('title_lv3', 'system', 'title', '논객',            0, 'free'),
  ('title_lv4', 'system', 'title', '설득의 달인',     0, 'free'),
  ('title_lv5', 'system', 'title', '광장의 웅변가',   0, 'free'),
  ('title_lv6', 'system', 'title', '여론의 지휘자',   0, 'free'),
  ('title_lv7', 'system', 'title', '아고라의 현자',   0, 'free')
ON CONFLICT DO NOTHING;
