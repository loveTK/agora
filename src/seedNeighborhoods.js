// AGORA V3(동단위 정복 MVP) 시드 — 기존 seed.js(V2 지역/논제)와는 완전히 별도 파일로 둔다.
// 실제 행정동 GIS 데이터는 쓰지 않고, 도시(regions) 6곳에 동 5~8개씩 손으로 큐레이션해서 넣는다.
// INSERT OR IGNORE(parent_region_id, name UNIQUE)라 재배포 시에도 중복 삽입되지 않는다.
const { randomUUID } = require("crypto");
const { db } = require("./db");

const NPC_DIFFICULTY_DEFAULT = 30; // 기여 포인트 몇 번이면 해방되는지 감 잡기 쉽게 낮게 잡음(MVP 검증용)

// 각 도시(REGIONS의 name과 일치해야 함)에 동을 5~8개씩. 순서대로 링(고리) 형태로 인접 등록한다
// (n번째 동은 n-1, n+1번째와 인접 — 마지막은 첫 번째와도 인접) — 실제 지리와는 무관한 장식용 배치다.
const CITY_NEIGHBORHOODS = {
  "서울": ["강남", "홍대", "이태원", "종로", "잠실", "여의도"],
  "도쿄": ["시부야", "신주쿠", "아키하바라", "긴자", "아사쿠사"],
  "뉴욕": ["맨해튼", "브루클린", "퀸즈", "브롱크스", "스태튼아일랜드"],
  "런던": ["소호", "캠든", "그리니치", "브릭스턴", "웨스트민스터"],
  "파리": ["몽마르트", "마레", "라탱지구", "샹젤리제", "벨빌"],
  "베를린": ["미테", "크로이츠베르크", "프렌츨라우어베르크", "노이쾰른", "샤를로텐부르크"],
};

// 동그마다 부모 지역 좌표 주변에 살짝 흩뿌린 좌표를 준다(실제 GIS 아님, 지도 표시용 장식일 뿐).
function jitter(base, seedIndex) {
  const angle = (seedIndex / 8) * Math.PI * 2;
  return base + Math.cos(angle) * 0.06 + Math.sin(angle * 1.7) * 0.02;
}

function seedNeighborhoodsIfEmpty() {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM neighborhoods").get().count;
  if (existing > 0) {
    console.log("[seed-v3] 동 데이터가 이미 있어 시드를 건너뜁니다.");
    return;
  }

  const insertNeighborhood = db.prepare(
    `INSERT OR IGNORE INTO neighborhoods (id, parent_region_id, name, status, npc_difficulty, lat, lng)
     VALUES (?, ?, ?, 'npc', ?, ?, ?)`
  );
  const insertAdjacency = db.prepare(
    `INSERT OR IGNORE INTO neighborhood_adjacency (neighborhood_id, adjacent_neighborhood_id) VALUES (?, ?)`
  );

  let totalCities = 0;
  let totalNeighborhoods = 0;

  const tx = db.transaction(() => {
    for (const [cityName, neighborhoodNames] of Object.entries(CITY_NEIGHBORHOODS)) {
      const region = db.prepare("SELECT id, lat, lng FROM regions WHERE name = ?").get(cityName);
      if (!region) {
        console.warn(`[seed-v3] 지역을 찾을 수 없어 건너뜀: ${cityName}`);
        continue;
      }

      const ids = neighborhoodNames.map(() => randomUUID());
      neighborhoodNames.forEach((name, i) => {
        insertNeighborhood.run(
          ids[i],
          region.id,
          name,
          NPC_DIFFICULTY_DEFAULT,
          jitter(region.lat, i),
          jitter(region.lng, i + 4)
        );
      });

      // 링(고리) 형태로 양방향 인접 등록 — n <-> n+1, 마지막 <-> 처음.
      for (let i = 0; i < ids.length; i++) {
        const a = ids[i];
        const b = ids[(i + 1) % ids.length];
        insertAdjacency.run(a, b);
        insertAdjacency.run(b, a);
      }

      totalCities++;
      totalNeighborhoods += ids.length;
    }
  });
  tx();

  console.log(`[seed-v3] 동단위 정복 시드 완료 — 도시 ${totalCities}곳, 동 ${totalNeighborhoods}개`);
}

module.exports = { seedNeighborhoodsIfEmpty, NPC_DIFFICULTY_DEFAULT };
