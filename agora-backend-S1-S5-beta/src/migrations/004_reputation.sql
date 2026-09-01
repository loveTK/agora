-- AGORA: 지역 이동 시 초기화 대상 필드 추가
-- reputation(명성 수치)은 계급(rank) 승급의 기준이 되는 누적 수치.
-- 지역을 이동하면 rank, reputation은 0/citizen으로 초기화된다(정책 합의사항).
-- 반대로 종교/정당 소속(religion_members, party_members — S8에서 추가 예정)은 유지된다.

ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0;
