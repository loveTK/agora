// 핵심 API 흐름 스모크 테스트. 실행 중인 서버에 대고 돈다: BASE=http://localhost:4000 npm run smoke
// 가입 → 로그인 → 지도 클러스터/검색/bbox → 기여(해방) → 논제·논증·추천 → 지도 기록·투표·댓글. 실패하면 exit 1.
const BASE = process.env.BASE || "http://localhost:4000";
const J = { "content-type": "application/json" };
const stamp = Date.now();
let failed = 0;

async function api(method, path, { body, token, expect = 200 } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...J, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  const ok = res.status === expect && data !== null;
  console.log(`${ok ? "ok " : "FAIL"} ${method} ${path} → ${res.status}${data === null ? " (JSON 아님)" : ""}`);
  if (!ok) { failed++; console.log("     " + text.slice(0, 200)); }
  return data;
}

async function signup(name) {
  const regions = await api("GET", "/regions");
  const r = await api("POST", "/auth/signup", {
    body: { email: `${name}-${stamp}@smoke.test`, password: "password1", nickname: `${name}${stamp % 1000}`, region_id: regions[0].id },
    expect: 201,
  });
  return { token: r.token, region: regions[0].id, id: r.user.id };
}

(async () => {
  await api("GET", "/health");
  await api("GET", "/nope", { expect: 404 });
  const a = await signup("a");
  const b = await signup("b");
  await api("POST", "/auth/login", { body: { email: `a-${stamp}@smoke.test`, password: "password1" } });
  await api("GET", "/users/me", { token: a.token });

  await api("GET", "/neighborhoods/clusters?level=region");
  await api("GET", "/neighborhoods/clusters?level=province&bbox=33,124,39,132");
  const found = await api("GET", "/neighborhoods/search?q=" + encodeURIComponent("서울 강남"));
  const rows = await api("GET", "/neighborhoods?bbox=37,126,38,128");
  const n = (found && found[0]) || rows[0];
  for (let i = 0; i < 4; i++) await api("POST", `/neighborhoods/${n.id}/contribute`, { token: a.token, expect: 201 });
  await api("GET", `/neighborhoods/${n.id}`, { token: a.token });
  await api("GET", "/neighborhoods/season/current");

  const th = await api("POST", "/threads", { body: { region_id: a.region, title: `스모크 논제 ${stamp}`, body: "본문" }, token: a.token, expect: 201 });
  await api("GET", `/threads/${th.id}`);
  const arg = await api("POST", `/threads/${th.id}/arguments`, { body: { stance: "pro", title: "논증", body: "본문입니다 열 자 이상" }, token: a.token, expect: 201 });
  await api("POST", `/arguments/${arg.id}/vote`, { body: { vote_type: "up" }, token: b.token });
  await api("POST", `/arguments/${arg.id}/laugh`, { token: b.token });
  await api("POST", `/threads/${th.id}/vote`, { body: { vote_type: "up" }, token: b.token });
  await api("GET", "/hot-agenda");

  const post = await api("POST", "/map-posts", { body: { lat: 37.5, lng: 127, body: "스모크 기록" }, token: a.token, expect: 201 });
  await api("POST", `/map-posts/${post.id}/vote`, { body: { vote_type: "fool" }, token: b.token });
  await api("POST", `/map-posts/${post.id}/comments`, { body: { body: "댓글" }, token: b.token, expect: 201 });
  await api("GET", "/map-posts");
  await api("POST", `/users/${a.id}/follow`, { token: b.token, expect: 200 });
  await api("GET", "/hall-of-fame");
  await api("GET", "/items/shop", { token: a.token });

  console.log(failed ? `\n실패 ${failed}건` : "\n전부 통과");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
