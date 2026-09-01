const { db } = require("../db");

// 자동 필터 1차: 금칙어 포함 여부만 검사(대소문자 무시, 부분일치).
// 정교한 판단(맥락, 풍자 등)은 신고 기반 2차 검수(관리자)가 담당한다.
function containsBannedWord(text) {
  if (!text) return false;
  const words = db.prepare("SELECT word FROM banned_words").all();
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.word.toLowerCase()));
}

module.exports = { containsBannedWord };
