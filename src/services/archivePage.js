const fs = require("fs");
const path = require("path");
const { db } = require("../db");

const SITE_ORIGIN = "https://myagora.xyz";
const ARCHIVE_PATH = path.join(__dirname, "..", "..", "archive.html");

function escapeHtml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

// 논제 아카이브 — 지역(실제 존재하는 유일한 분류 축)별로 모으고, 그 안에서 참여도(추천+논증 수)
// 순으로 정렬한다. 운영팀 시드 논제 30건도 일반 논제와 동일하게 자연 포함된다.
function buildArchiveHtml() {
  const regions = db.prepare("SELECT id, name FROM regions ORDER BY name").all();
  const threads = db
    .prepare(
      `SELECT t.id, t.title, t.region_id, t.created_at,
              (SELECT COALESCE(SUM(CASE WHEN tv.vote_type = 'up' THEN tv.weight ELSE 0 END), 0)
                 FROM thread_votes tv WHERE tv.thread_id = t.id) AS upvotes,
              (SELECT COUNT(*) FROM arguments a WHERE a.thread_id = t.id) AS argument_count
       FROM threads t
       WHERE t.hidden = 0 AND t.status = 'active'`
    )
    .all();

  const byRegion = {};
  threads.forEach((t) => {
    (byRegion[t.region_id] ||= []).push(t);
  });
  Object.values(byRegion).forEach((list) =>
    list.sort((a, b) => b.upvotes + b.argument_count - (a.upvotes + a.argument_count))
  );

  const totalCount = threads.length;

  const sections = regions
    .filter((r) => byRegion[r.id] && byRegion[r.id].length)
    .map(
      (r) => `
      <section class="region-block">
        <h2>${escapeHtml(r.name)} 폴리스 <span class="count">${byRegion[r.id].length}건</span></h2>
        <ul class="thread-list">
          ${byRegion[r.id]
            .map(
              (t) => `
          <li>
            <a href="/?thread=${t.id}">${escapeHtml(t.title)}</a>
            <span class="meta">논증 ${t.argument_count} · 추천 ${Math.round(t.upvotes)}</span>
          </li>`
            )
            .join("")}
        </ul>
      </section>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>논제 아카이브 — AGORA</title>
<meta name="description" content="AGORA에 등록된 모든 논제를 지역별·참여도 순으로 모아봅니다. 총 ${totalCount}건의 논제가 19개 폴리스에서 진행 중입니다.">
<link rel="canonical" href="${SITE_ORIGIN}/archive.html">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AGORA">
<meta property="og:title" content="논제 아카이브 — AGORA">
<meta property="og:description" content="AGORA에 등록된 모든 논제를 지역별·참여도 순으로 모아봅니다.">
<meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
<meta property="og:url" content="${SITE_ORIGIN}/archive.html">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --black:#111110; --ink:#1c1c1a; --gray-1:#4a4a46; --gray-2:#8a8a84;
    --gray-4:#e6e6e0; --white:#ffffff; --line:rgba(17,17,16,0.14); --gold:#BA7517; --on-gold:#111110;
  }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{ background:var(--white); color:var(--ink); font-family:'Archivo',sans-serif; line-height:1.6; }
  .shell{ max-width:900px; margin:0 auto; padding:0 24px; }
  header{ border-bottom:1px solid var(--line); padding:22px 0; }
  header .shell{ display:flex; align-items:baseline; justify-content:space-between; }
  .wordmark{ font-weight:800; letter-spacing:0.14em; font-size:20px; }
  .wordmark span{ font-weight:500; color:var(--gray-2); font-size:13px; margin-left:10px; }
  header a.cta{ background:var(--gold); color:var(--on-gold); text-decoration:none; padding:10px 20px; font-size:13px; font-weight:700; }
  main{ padding:48px 0 80px; }
  .eyebrow{ font-size:11.5px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--gold); margin-bottom:14px; }
  h1{ font-weight:900; font-size:clamp(26px,4vw,36px); letter-spacing:-0.01em; margin-bottom:10px; }
  .lede{ font-size:15px; color:var(--gray-1); margin-bottom:40px; }
  .region-block{ margin-bottom:40px; }
  .region-block h2{ font-size:17px; font-weight:800; margin-bottom:10px; padding-bottom:10px; border-bottom:2px solid var(--black); }
  .region-block .count{ font-weight:500; font-size:12.5px; color:var(--gray-2); }
  .thread-list{ list-style:none; }
  .thread-list li{ display:flex; justify-content:space-between; gap:16px; padding:11px 0; border-bottom:1px solid var(--line); flex-wrap:wrap; }
  .thread-list li:last-child{ border-bottom:none; }
  .thread-list a{ color:var(--ink); text-decoration:none; font-size:14.5px; font-weight:600; }
  .thread-list a:hover{ color:var(--gold); }
  .thread-list .meta{ font-size:12px; color:var(--gray-2); white-space:nowrap; }
  footer{ border-top:1px solid var(--line); padding:20px 0; font-size:12px; color:var(--gray-2); }
</style>
</head>
<body>
<header><div class="shell"><div class="wordmark">ΑΓΟΡΑ<span>agora</span></div><a class="cta" href="${SITE_ORIGIN}/">사이트 입장</a></div></header>
<main>
  <div class="shell">
    <div class="eyebrow">Archive</div>
    <h1>논제 아카이브</h1>
    <p class="lede">지금까지 등록된 논제 ${totalCount}건을 폴리스(지역)별, 참여도 순으로 모았습니다.</p>
    ${sections}
  </div>
</main>
<footer><div class="shell">업데이트: ${new Date().toISOString().slice(0, 10)} · <a href="${SITE_ORIGIN}/">myagora.xyz</a></div></footer>
</body>
</html>
`;
}

function regenerateArchive() {
  try {
    fs.writeFileSync(ARCHIVE_PATH, buildArchiveHtml());
  } catch (err) {
    console.error("[archive] 갱신 실패:", err.message);
  }
}

module.exports = { regenerateArchive, buildArchiveHtml };
