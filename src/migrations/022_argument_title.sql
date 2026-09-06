-- 논증 등록을 [타이틀] + [설명] 형식으로 받기 위해 title 컬럼을 추가한다.
ALTER TABLE arguments ADD COLUMN title TEXT NOT NULL DEFAULT '';
