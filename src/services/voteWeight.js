// 추천/비추천/바보 반응은 계정 연령과 무관하게 항상 1표로 집계한다(기획 변경: 신규 계정 가중치 폐지).
function getVoteWeight() {
  return 1.0;
}

module.exports = { getVoteWeight };
