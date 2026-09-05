// 호전성 게이지 (기획 합의사항: 발의 +2, 답글 +1로 누적. 다작 논객 랭킹과 통합된 단일 축 —
// 별도의 "웅변가" 뱃지는 두지 않고 이 게이지 하나로 발언량 기여를 대표한다.)
const THREAD_BELLIGERENCE_POINTS = 2; // 논제(아젠다) 발의 1건당
const ARGUMENT_BELLIGERENCE_POINTS = 1; // 논증(답글) 등록 1건당

const WARRIOR_THRESHOLD = 100; // 논전사 — 무기 슬롯 언락
const ELITE_WARRIOR_THRESHOLD = 300; // 정예 논전사

function belligerenceTier(value) {
  if (value >= ELITE_WARRIOR_THRESHOLD) return "elite_warrior";
  if (value >= WARRIOR_THRESHOLD) return "warrior";
  return "citizen";
}

module.exports = {
  THREAD_BELLIGERENCE_POINTS,
  ARGUMENT_BELLIGERENCE_POINTS,
  WARRIOR_THRESHOLD,
  ELITE_WARRIOR_THRESHOLD,
  belligerenceTier,
};
