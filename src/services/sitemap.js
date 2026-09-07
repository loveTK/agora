const fs = require("fs");
const path = require("path");
const { db } = require("../db");

const SITE_ORIGIN = "https://myagora.xyz";
// 프론트(agora.html)를 정적으로 서빙하는 nginx의 root와 같은 디렉터리(레포 루트)에 써야
// try_files /sitemap.xml 이 그대로 최신 파일을 내려준다.
const SITEMAP_PATH = path.join(__dirname, "..", "..", "sitemap.xml");

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}

function buildSitemapXml() {
  const regions = db.prepare("SELECT id FROM regions").all();
  const threads = db
    .prepare("SELECT id, created_at FROM threads WHERE status = 'active' AND hidden = 0 ORDER BY created_at DESC")
    .all();

  const urls = [
    { loc: `${SITE_ORIGIN}/`, changefreq: "daily", priority: "1.0" },
    ...regions.map((r) => ({ loc: `${SITE_ORIGIN}/?region=${r.id}`, changefreq: "hourly", priority: "0.8" })),
    ...threads.map((t) => ({
      loc: `${SITE_ORIGIN}/?thread=${t.id}`,
      lastmod: t.created_at.slice(0, 10),
      changefreq: "daily",
      priority: "0.6",
    })),
  ];

  const body = urls
    .map(
      (u) => `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ""}    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// 논제는 계속 새로 생기므로 매 배포 때(재시작 시)뿐 아니라 논제 등록 직후에도 다시 써서
// sitemap.xml이 정적 파일이어도 실제 콘텐츠와 크게 어긋나지 않게 한다.
function regenerateSitemap() {
  try {
    fs.writeFileSync(SITEMAP_PATH, buildSitemapXml());
  } catch (err) {
    console.error("[sitemap] 갱신 실패:", err.message);
  }
}

module.exports = { regenerateSitemap, buildSitemapXml };
