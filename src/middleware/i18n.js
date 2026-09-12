// 응답 JSON의 error/message 문자열을 Accept-Language(또는 ?lang=)에 맞춰 바꿔 보낸다.
// 라우트는 한국어 원문 그대로 두고, 사전(i18n/messages.json)은 프론트와 공유한다.
const D = require("../../i18n/messages.json");
const LANGS = ["en", "ja", "zh"];
const NUM = /\d+(?:[.,]\d+)?/g;

function pickLang(req) {
  if (LANGS.includes(req.query.lang)) return req.query.lang;
  const first = String(req.headers["accept-language"] || "").split(",")[0].trim().slice(0, 2).toLowerCase();
  return LANGS.includes(first) ? first : null;
}

// "비밀번호는 8자 이상" → 키 "비밀번호는 {n}자 이상" 조회 후 숫자를 순서대로 되돌려 넣는다.
function translate(s, lang) {
  const nums = [];
  const key = s.replace(NUM, (m) => (nums.push(m), "{n}")).replace(/\s+/g, " ").trim();
  const e = D[key] && D[key][lang];
  if (!e) return s;
  let i = 0;
  return e.replace(/\{n\}/g, () => nums[i++] ?? "");
}

function i18n(req, res, next) {
  const lang = pickLang(req);
  if (!lang) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === "object") {
      for (const k of ["error", "message"]) if (typeof body[k] === "string") body[k] = translate(body[k], lang);
    }
    return json(body);
  };
  next();
}

module.exports = { i18n, translate, pickLang };

if (require.main === module) {
  const assert = require("assert");
  assert.strictEqual(translate("비밀번호는 8자 이상이어야 합니다.", "en"), "Password must be at least 8 characters.");
  assert.strictEqual(translate("사전에 없는 문장", "en"), "사전에 없는 문장");
  assert.strictEqual(pickLang({ query: {}, headers: { "accept-language": "ja-JP,ja;q=0.9,en;q=0.8" } }), "ja");
  assert.strictEqual(pickLang({ query: {}, headers: { "accept-language": "ko-KR,en;q=0.8" } }), null);
  assert.strictEqual(pickLang({ query: { lang: "zh" }, headers: {} }), "zh");
  console.log("i18n ok");
}
