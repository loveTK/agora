// Natural Earth admin-1 → src/data/admin1.json. 사용: node scripts/gen-admin1.js <NE geojson 폴더>
// 폴더에 ne_10m_admin_1_states_provinces.geojson, ne_110m_admin_0_countries.geojson 을 받아둔다
// (https://github.com/nvkelso/natural-earth-vector/tree/master/geojson). 기존 REAL 15개국 제외, 30곳 넘고 region이 있으면 region 단위로 묶는다.
const fs = require("fs");
const S = process.argv[2] || __dirname;
const a1 = JSON.parse(fs.readFileSync(S + "/ne_admin1.geojson", "utf8")).features.map((x) => x.properties);
const { COUNTRIES } = require("../src/seedCountries");
const cap = Object.fromEntries(COUNTRIES.map(([n, lat, lng]) => [n, [lat, lng]]));
const REAL = new Set(["대한민국", "미국", "중국", "일본", "독일", "프랑스", "영국", "이탈리아", "스페인", "캐나다", "호주", "브라질", "인도", "멕시코", "러시아"]);

const a0 = JSON.parse(fs.readFileSync(S + "/ne_admin0.geojson", "utf8")).features.map((x) => x.properties);
const koSet = new Set(COUNTRIES.map((c) => c[0]));
const en2ko = Object.assign(Object.fromEntries(a0.filter((p) => koSet.has(p.NAME_KO)).map((p) => [p.ADMIN, p.NAME_KO])), {
  "North Korea": "북한", "South Africa": "남아프리카공화국", "Republic of the Congo": "콩고공화국",
  "Democratic Republic of the Congo": "콩고민주공화국", "Czech Republic": "체코", "Macedonia": "북마케도니아", "Turkey": "튀르키예",
  "Central African Republic": "중앙아프리카공화국", "Liechtenstein": "리히텐슈타인", "San Marino": "산마리노",
  "Dominican Republic": "도미니카공화국", "Monaco": "모나코", "Swaziland": "에스와티니", "Andorra": "안도라",
  "Guinea Bissau": "기니비사우", "Gibraltar": "지브롤터", "Equatorial Guinea": "적도기니", "Hong Kong S.A.R.": "홍콩",
  "Vatican": "바티칸", "New Caledonia": "뉴칼레도니아", "Taiwan": "대만", "Curaçao": "쿠라사오", "Aruba": "아루바",
  "Turks and Caicos Islands": "터크스케이커스제도", "Saint Pierre and Miquelon": "생피에르미클롱", "Pitcairn Islands": "핏케언제도",
  "French Polynesia": "프랑스령폴리네시아", "French Southern and Antarctic Lands": "프랑스령남방영토", "Seychelles": "세이셸",
  "Kiribati": "키리바시", "Marshall Islands": "마셜제도", "Trinidad and Tobago": "트리니다드토바고", "Grenada": "그레나다",
  "Caribbean Netherlands": "보네르", "Saint Vincent and the Grenadines": "세인트빈센트그레나딘", "Barbados": "바베이도스",
  "Saint Lucia": "세인트루시아", "Dominica": "도미니카연방", "Montserrat": "몬트세랫", "Antigua and Barbuda": "앤티가바부다",
  "Saint Kitts and Nevis": "세인트키츠네비스", "United States Virgin Islands": "미국령버진아일랜드", "Anguilla": "앵귈라",
  "British Virgin Islands": "영국령버진아일랜드", "Cayman Islands": "케이맨제도", "Bermuda": "버뮤다",
  "Heard Island and McDonald Islands": "허드맥도널드제도", "Saint Helena": "세인트헬레나", "Mauritius": "모리셔스", "Comoros": "코모로",
  "Sao Tome and Principe": "상투메프린시페", "Cape Verde": "카보베르데", "Malta": "몰타", "Jersey": "저지", "Guernsey": "건지",
  "Isle of Man": "맨섬", "Aland": "올란드제도", "Faroe Islands": "페로제도", "Singapore": "싱가포르", "Norfolk Island": "노퍽섬",
  "Cook Islands": "쿡제도", "Tonga": "통가", "Wallis and Futuna": "왈리스푸투나", "Samoa": "사모아", "Solomon Islands": "솔로몬제도",
  "Tuvalu": "투발루", "Maldives": "몰디브", "Nauru": "나우루", "Federated States of Micronesia": "미크로네시아",
  "South Georgia and the Islands": "사우스조지아", "Falkland Islands": "포클랜드제도", "Niue": "니우에", "American Samoa": "아메리칸사모아",
  "Palau": "팔라우", "Guam": "괌", "Northern Mariana Islands": "북마리아나제도", "Bahrain": "바레인", "Macau S.A.R": "마카오",
  "S. Sudan": "남수단", "Saint Martin": "생마르탱", "Sint Maarten": "신트마르턴", "Gaza Strip": "팔레스타인", "West Bank": "팔레스타인",
  "Australia": "호주", "China": "중국",
});

const by = {};
for (const p of a1) {
  const ko = en2ko[p.admin];
  if (!ko || REAL.has(ko) || !cap[ko]) continue;
  (by[ko] ||= []).push(p);
}

const dist = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180));
const out = {};
for (const [ko, ps] of Object.entries(by)) {
  let provinces;
  const regions = new Set(ps.map((p) => p.region).filter(Boolean));
  const covered = ps.filter((p) => p.region).length / ps.length;
  if (ps.length > 30 && regions.size >= 2 && covered >= 0.95) {
    const g = {};
    for (const p of ps) if (p.region) (g[p.region] ||= []).push(p);
    provinces = Object.entries(g).map(([name, ms]) => [
      name,
      +(ms.reduce((s, m) => s + m.latitude, 0) / ms.length).toFixed(4),
      +(ms.reduce((s, m) => s + m.longitude, 0) / ms.length).toFixed(4),
    ]);
  } else {
    provinces = ps
      .filter((p) => p.name_ko || p.name_en || p.name)
      .map((p) => [p.name_ko || p.name_en || p.name, +p.latitude.toFixed(4), +p.longitude.toFixed(4)]);
  }
  if (!provinces.length) continue;
  // 이름 중복 제거(같은 이름 두 번이면 뒤에 번호)
  const seen = {};
  for (const p of provinces) { seen[p[0]] = (seen[p[0]] || 0) + 1; if (seen[p[0]] > 1) p[0] = `${p[0]} ${seen[p[0]]}`; }
  // 수도에 가장 가까운 광역이 첫 항목
  const c = cap[ko];
  provinces.sort((a, b) => dist([a[1], a[2]], c) - dist([b[1], b[2]], c));
  // 구 간격 = 광역 최근접 거리 중앙값 × 0.3
  let spread = 0.1;
  if (provinces.length > 1) {
    const nn = provinces.map((p) => Math.min(...provinces.filter((q) => q !== p).map((q) => dist([p[1], p[2]], [q[1], q[2]]))));
    nn.sort((a, b) => a - b);
    spread = Math.max(0.05, Math.min(1.5, nn[nn.length >> 1] * 0.3));
  }
  out[ko] = { spread: +spread.toFixed(2), provinces };
}
fs.writeFileSync(__dirname + "/../src/data/admin1.json", JSON.stringify(out));
const n = Object.values(out).reduce((s, c) => s + c.provinces.length, 0);
console.log("countries", Object.keys(out).length, "provinces", n, "missing:", COUNTRIES.map((c) => c[0]).filter((k) => !out[k] && !REAL.has(k)).join(","));
