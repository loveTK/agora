-- PANGAEA 2단계: 국가(regions) → 광역(provinces) → 구(neighborhoods) 3단 계층.
-- 영토가 수천 곳으로 늘어나면서 지도에 전부 찍을 수 없게 됐다. 줌에 따라 국가 묶음 → 광역 묶음 →
-- 개별 구로 펼치는 클러스터링의 기준 단위가 이 테이블이다. 좌표는 여전히 지도 표시용 장식값이다.
CREATE TABLE IF NOT EXISTS provinces (
  id          TEXT PRIMARY KEY,
  region_id   TEXT NOT NULL REFERENCES regions(id),
  name        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  is_capital  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (region_id, name)
);
CREATE INDEX IF NOT EXISTS idx_provinces_region ON provinces(region_id);

ALTER TABLE neighborhoods ADD COLUMN province_id TEXT REFERENCES provinces(id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_province ON neighborhoods(province_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_latlng ON neighborhoods(lat, lng);

-- 지도 기록은 좌표만 있어서 묶음별 기록·댓글 수를 셀 수 없었다. 작성 시 가장 가까운 광역을 붙인다.
ALTER TABLE map_posts ADD COLUMN province_id TEXT REFERENCES provinces(id);
CREATE INDEX IF NOT EXISTS idx_map_posts_province ON map_posts(province_id);

-- 24시간 활동 점수(🔥) 집계가 created_at 범위 조회라 인덱스가 없으면 묶음마다 풀스캔이 된다.
CREATE INDEX IF NOT EXISTS idx_neighborhood_contrib_created ON neighborhood_contributions(created_at);
CREATE INDEX IF NOT EXISTS idx_neighborhood_attacks_created ON neighborhood_attacks(created_at);
CREATE INDEX IF NOT EXISTS idx_map_post_comments_created ON map_post_comments(created_at);
