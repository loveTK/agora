-- AGORA S10: 다중계정 협업형 어뷰징(투표 몰표, 팔로우 몰이, 집단 가입) 탐지를 위한 IP 기록

ALTER TABLE votes ADD COLUMN ip TEXT;
ALTER TABLE follows ADD COLUMN ip TEXT;
ALTER TABLE religion_members ADD COLUMN ip TEXT;
ALTER TABLE party_members ADD COLUMN ip TEXT;

CREATE INDEX IF NOT EXISTS idx_votes_ip ON votes(ip);
CREATE INDEX IF NOT EXISTS idx_follows_ip ON follows(ip);
