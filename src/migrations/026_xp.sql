-- V1 재조정: 경험치(XP)/레벨 시스템 신설. 레벨은 저장하지 않고 xp로부터 그때그때 계산한다
-- (services/experience.js의 LEVEL_TABLE 참고 — 값 조정이 마이그레이션 없이 가능하게 하기 위함).
ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
