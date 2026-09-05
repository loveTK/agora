const { randomUUID, randomBytes } = require("crypto");
const bcrypt = require("bcryptjs");
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

// 오픈 전 콘텐츠 큐레이션용 시드 논제 30개.
// "가상 계정으로 활동을 위장"하지 않고, 명시적으로 "AGORA 운영팀" 계정 하나로 투명하게 게시한다.
// (기획 문서 13.4절 "톤앤매너 전략 — 시드 질문 30선"과 동일)
const OFFICIAL_QUESTIONS = [
  "치코리타로 기름을 짜면 동물성 기름일까 식물성 기름일까?",
  "엉덩이는 하나일까 두 개일까?",
  "상어는 물고기인데 물을 마시는 걸까?",
  "인간이 알을 낳는 종이었다면 계란빵은 인육빵일까?",
  "자판기에서 캔이 떨어지는 소리는 자연의 소리일까 인공의 소리일까?",
  "라면을 젓가락으로 먹는 사람과 포크로 먹는 사람, 더 미개한 쪽은 누구일까?",
  "김밥 옆구리가 터지면 그건 실패작일까 새로운 요리일까?",
  "문어는 다리가 8개인데, 그중 몇 개는 '팔'로 봐야 하는가?",
  "자동문 앞에서 손을 흔드는 건 예의일까 미신일까?",
  "아이스 아메리카노의 얼음이 다 녹으면 그건 원래 음료의 연장일까 다른 음료일까?",
  "갈기 없는 사자 캐릭터는 사자로서 정체성 위기를 겪는가?",
  "계단을 두 칸씩 오르는 사람은 시간을 아끼는 걸까 무릎을 버리는 걸까?",
  "민트초코를 싫어하는 것은 미각의 문제인가 인성의 문제인가?",
  "새우튀김의 꼬리는 먹는 게 예의인가 남기는 게 예의인가?",
  "캐릭터 배에 화면이 있다면, 그건 눈인가 배꼽인가?",
  "눈사람에게 다리가 없는 것은 신체적 결함인가 원래 그런 종족인가?",
  "지우개 똥은 지우개의 배설물인가 지우개의 시체 조각인가?",
  "딸기 우유에 실제 딸기가 안 들어있다면 그건 사기인가 국룰인가?",
  "산타클로스가 매년 늙지 않는 이유는 무한동력인가 시간정지 능력인가?",
  "목욕탕 사물함 열쇠를 발목에 차는 것은 패션인가 생존 전략인가?",
  "코털을 뽑으면 콧구멍이 넓어질까 원상복구될까?",
  "회전초밥집에서 안 먹은 접시를 다시 올려놓으면 재활용인가 반칙인가?",
  "날지 못하는 펭귄 캐릭터는 그 사실을 슬퍼한 적이 있을까 없을까?",
  "방귀 소리와 냄새, 둘 중 무엇이 더 그 사람의 인격을 대변하는가?",
  "무한리필 고깃집에서 혼자 3인분을 다 먹으면 배려 없음인가, 사장님과의 암묵적 계약 이행인가?",
  "곰 모양 젤리는 곰의 존엄성을 해치는 디자인인가, 귀여움의 정당한 표현인가?",
  "아무도 없는 새벽에 빨간불 도로를 건너는 것은 합리적 선택인가 사회계약 위반인가?",
  "아이스크림을 깨물어 먹는 사람과 녹여 먹는 사람, 누가 더 인내심이 없는가?",
  "병뚜껑을 만지작거리는 습관은 심리적 안정 추구인가 주변인에 대한 무례인가?",
  "시리얼에 우유를 먼저 넣을지 시리얼을 먼저 넣을지 — 취향의 문제인가 과학적 정답이 있는 문제인가?",
];

const OFFICIAL_EMAIL = "team@agora.official";
const OFFICIAL_NICKNAME = "AGORA 운영팀";

// 실제 활동을 위장하는 가짜 계정이 아니라, 닉네임에 "운영팀"임을 명시한 단일 공식 계정으로
// 오픈 전 콘텐츠를 투명하게 채운다. 일일 등록 한도(API 레벨 제약)는 신뢰된 시드 코드이므로 우회한다.
function seedOfficialContent() {
  let official = db.prepare("SELECT * FROM users WHERE email = ?").get(OFFICIAL_EMAIL);

  if (!official) {
    const regions = db.prepare("SELECT id FROM regions").all();
    if (regions.length === 0) {
      console.log("[seed] 지역 데이터가 없어 운영팀 계정 생성을 건너뜁니다.");
      return;
    }
    const password = randomBytes(9).toString("base64url"); // 임의 비밀번호, 아래 로그로만 확인 가능
    const id = randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, nickname, region_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, OFFICIAL_EMAIL, bcrypt.hashSync(password, 10), OFFICIAL_NICKNAME, regions[0].id);
    official = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    console.log(`[seed] 운영팀 계정 생성됨 — 이메일: ${OFFICIAL_EMAIL} / 임시 비밀번호: ${password} (반드시 별도로 기록해둘 것)`);
  }

  const existingCount = db
    .prepare("SELECT COUNT(*) AS count FROM threads WHERE author_id = ?")
    .get(official.id).count;
  if (existingCount >= OFFICIAL_QUESTIONS.length) {
    console.log("[seed] 운영팀 시드 논제가 이미 게시되어 있어 건너뜁니다.");
    return;
  }

  const regions = db.prepare("SELECT id FROM regions").all();
  const insertThread = db.prepare(
    `INSERT INTO threads (id, region_id, author_id, title, status) VALUES (?, ?, ?, ?, 'active')`
  );
  const tx = db.transaction((questions) => {
    questions.forEach((title, i) => {
      const region = regions[i % regions.length]; // 지역별로 고르게 분산
      insertThread.run(randomUUID(), region.id, official.id, title);
    });
  });
  tx(OFFICIAL_QUESTIONS.slice(existingCount));
  console.log(`[seed] 운영팀 시드 논제 ${OFFICIAL_QUESTIONS.length - existingCount}건 게시 완료`);
}

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
// 지역 데이터가 없으면 기본 시드를 실행하고, 운영팀 공식 콘텐츠는 매번 상태를 확인해 부족한 만큼만 채운다.
function seedIfEmpty() {
  const regionCount = db.prepare("SELECT COUNT(*) AS count FROM regions").get().count;
  if (regionCount > 0) {
    console.log("[seed] 지역 데이터는 이미 있어 기본 시드는 건너뜁니다.");
  } else {
    seed();
  }
  seedOfficialContent();
}

// CLI로 직접 실행했을 때(`npm run seed`)는 무조건 시드 실행 (로컬 개발용)
if (require.main === module) {
  runMigrations();
  seed();
  seedOfficialContent();
}

module.exports = { seed, seedIfEmpty, seedOfficialContent };
