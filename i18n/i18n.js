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
