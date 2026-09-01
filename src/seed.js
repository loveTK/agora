const { randomUUID } = require("crypto");
const { db, runMigrations } = require("./db");

// 알파 오픈 대상으로 논의된 대표 지역 6곳을 시드로 넣습니다.
const REGIONS = [
  { name: "서울", lat: 37.5665, lng: 126.9780 },
  { name: "도쿄", lat: 35.6762, lng: 139.6503 },
  { name: "뉴욕", lat: 40.7128, lng: -74.0060 },
  { name: "런던", lat: 51.5074, lng: -0.1278 },
  { name: "베를린", lat: 52.5200, lng: 13.4050 },
  { name: "상하이", lat: 31.2304, lng: 121.4737 },
];

// 금칙어 자리표시자 시드 (실제 배포 전 CX/법무 검토된 진짜 목록으로 교체 필요)
const BANNED_WORDS = [
  { word: "테스트금칙어", category: "general" },
  { word: "혐오표현예시", category: "hate" },
  { word: "스팸광고예시", category: "spam" },
];

function seed() {
  const insertRegion = db.prepare(
    "INSERT OR IGNORE INTO regions (id, name, status, lat, lng) VALUES (?, ?, 'dispute', ?, ?)"
  );
  const regionTx = db.transaction((regions) => {
    for (const r of regions) insertRegion.run(randomUUID(), r.name, r.lat, r.lng);
  });
  regionTx(REGIONS);
  console.log(`[seed] ${REGIONS.length}개 지역 시드 완료`);

  const insertWord = db.prepare(
    "INSERT OR IGNORE INTO banned_words (id, word, category) VALUES (?, ?, ?)"
  );
  const wordTx = db.transaction((words) => {
    for (const w of words) insertWord.run(randomUUID(), w.word, w.category);
  });
  wordTx(BANNED_WORDS);
  console.log(`[seed] 금칙어 자리표시자 ${BANNED_WORDS.length}개 시드 완료 (운영 전 실제 목록으로 교체 필요)`);
}

// Render 무료 티어처럼 Shell(npm run seed)을 직접 실행할 수 없는 환경을 위한 안전장치.
// 지역 데이터가 하나도 없을 때만 자동으로 시드하므로, 여러 번 호출돼도 중복 삽입되지 않는다.
function seedIfEmpty() {
  const regionCount = db.prepare("SELECT COUNT(*) AS count FROM regions").get().count;
  if (regionCount > 0) {
    console.log("[seed] 이미 데이터가 있어 자동 시드를 건너뜁니다.");
    return;
  }
  seed();
}

// CLI로 직접 실행했을 때(`npm run seed`)는 무조건 시드 실행 (로컬 개발용)
if (require.main === module) {
  runMigrations();
  seed();
}

module.exports = { seed, seedIfEmpty };
