// 좌표 → 가장 가까운 광역(province). 지도 기록에는 좌표만 있어서 묶음별 기록·댓글 수를 세려면
// 작성 시점에 광역을 붙여야 한다. 광역은 수천 곳이라 메모리에 올려 두고 선형 탐색해도 1ms 안쪽이다.
const { db } = require("../db");

let cache = null;

function invalidateProvinceCache() {
  cache = null;
}

function nearestProvinceId(lat, lng) {
  if (!cache) cache = db.prepare("SELECT id, lat, lng FROM provinces").all();
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best = null;
  let bestDist = Infinity;
  for (const p of cache) {
    let dLng = Math.abs(p.lng - lng);
    if (dLng > 180) dLng = 360 - dLng; // 날짜변경선을 사이에 둔 두 점은 반대로 돌아가는 쪽이 가깝다
    const dist = (p.lat - lat) ** 2 + (dLng * cosLat) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = p.id;
    }
  }
  return best;
}

module.exports = { nearestProvinceId, invalidateProvinceCache };
