// 한국어 원문 DOM을 사전(messages.json)으로 바꿔치기한다. 언어: ?lang= > localStorage > 브라우저.
// 숫자는 {n}으로 정규화해 조회하므로 "댓글 3" 같은 동적 문자열도 잡힌다. 그 외 보간(이름 등)은 한국어로 남는다.
(() => {
  const LANGS = ["ko", "en", "ja", "zh"];
  const q = new URLSearchParams(location.search).get("lang");
  let lang = q || localStorage.getItem("lang") || (navigator.language || "ko").slice(0, 2);
  if (!LANGS.includes(lang)) lang = "ko";
  if (q) localStorage.setItem("lang", lang);
  window.LANG = lang;
  window.t = (s) => s;
  document.documentElement.lang = lang;

  // 언어 전환: 우하단 작은 select. 바꾸면 저장 후 새로고침(번역은 로드 시 한 번에 적용되므로).
  const NAMES = { ko: "한국어", en: "English", ja: "日本語", zh: "中文" };
  const mountSwitch = () => {
    const sel = document.createElement("select");
    sel.id = "langSwitch";
    sel.setAttribute("aria-label", "Language");
    sel.style.cssText = "position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:9999;font:12px system-ui,sans-serif;padding:3px 6px;border:1px solid rgba(17,17,16,.35);border-radius:4px;background:rgba(255,255,255,.92);color:#111;opacity:.85;cursor:pointer;";
    if (matchMedia("(max-width:600px)").matches) sel.style.bottom = "calc(56px + env(safe-area-inset-bottom))"; // 모바일 바텀시트 위
    for (const k of LANGS) {
      const o = document.createElement("option");
      o.value = k; o.textContent = NAMES[k]; o.selected = k === lang;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => { localStorage.setItem("lang", sel.value); location.reload(); });
    document.body.appendChild(sel);
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", mountSwitch) : mountSwitch();

  if (lang === "ko") return;

  const NUM = /\d+(?:[.,]\d+)?/g;
  const ATTRS = ["placeholder", "title", "aria-label"];
  let D = {};

  const tr = (s) => {
    const nums = [];
    const key = s.replace(NUM, (m) => (nums.push(m), "{n}")).replace(/\s+/g, " ").trim();
    const e = D[key] && D[key][lang];
    if (!e) return null;
    let i = 0;
    return s.match(/^\s*/)[0] + e.replace(/\{n\}/g, () => nums[i++] ?? "") + s.match(/\s*$/)[0];
  };
  window.t = (s) => tr(s) || s;

  const handle = (n) => {
    if (n.nodeType === 3) {
      const v = tr(n.nodeValue);
      if (v && v !== n.nodeValue) n.nodeValue = v;
    } else if (n.nodeType === 1) {
      for (const a of ATTRS) if (n.hasAttribute(a)) { const v = tr(n.getAttribute(a)); if (v) n.setAttribute(a, v); }
    }
  };
  const walk = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/^(SCRIPT|STYLE)$/.test(n.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    handle(root);
    while (w.nextNode()) handle(w.currentNode);
  };

  fetch("/i18n/messages.json").then((r) => r.json()).then((d) => {
    D = d;
    walk(document.documentElement);
    document.title = window.t(document.title);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else handle(m.target);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.dispatchEvent(new Event("i18n:ready"));
  });
})();
