-- 인벤토리 페이지 재구성: 아이템별 착용 여부를 저장한다.
-- 슬롯(모자/얼굴/상의 등)당 최대 1개 착용 제한은 DB 제약이 아니라 애플리케이션 레벨에서 강제한다
-- (slot_type이 items 테이블에 있어서 표현식 인덱스로는 걸 수 없음 — 020/021 등 기존 관례처럼
--  이런 종류의 불변식은 라우트 핸들러 트랜잭션에서 처리).
ALTER TABLE user_inventory ADD COLUMN equipped INTEGER NOT NULL DEFAULT 0;
