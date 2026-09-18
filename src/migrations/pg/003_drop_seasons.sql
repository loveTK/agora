-- 시즌제 폐지: 영토가 주기적으로 전부 초기화되던 기능을 제거한다. 챔피언 아카이브도 함께 버린다.
DROP TABLE IF EXISTS neighborhood_season_champions;
DROP TABLE IF EXISTS neighborhood_seasons;
