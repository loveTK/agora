// 종교/정당 창설 진입장벽 (기획 합의사항: 아무나 남발하지 못하게 임계값을 둔다)
const RELIGION_CREATE_REPUTATION_THRESHOLD = 150; // V1: 활성 100명 규모 재조정
const PARTY_CREATE_FOLLOWER_THRESHOLD = 10;        // V1: 활성 100명 규모 재조정
const TENET_MIN = 3;
const TENET_MAX = 5;

module.exports = {
  RELIGION_CREATE_REPUTATION_THRESHOLD,
  PARTY_CREATE_FOLLOWER_THRESHOLD,
  TENET_MIN,
  TENET_MAX,
};
