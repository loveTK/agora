const { randomUUID } = require("crypto");
const { db } = require("../db");
const { getVoteWeight } = require("./voteWeight");
const { checkAndGrantIngeniousTicker } = require("./ingeniousTicker");

// votes.js의 DAILY_VOTE_LIMIT과 동일한 취지 — 반복 토글로 우회하지 못하게 하루 총 횟수로 제한한다.
const DAILY_LAUGH_LIMIT = 100;

const TARGET_TABLES = { thread: "threads", argument: "arguments", reply: "argument_replies" };

function targetExists(targetType, targetId) {
  const table = TARGET_TABLES[targetType];
  return !!db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(targetId);
}

// thread/argument/reply 공용 "웃기다" 토글. 같은 대상에 재요청하면 취소된다(추천/비추천과 동일한 패턴).
// 정책: 본인 글에는 반응 불가, 신규 계정은 가중치가 낮음(voteWeight 재사용), 하루 총 횟수 제한.
function toggleLaugh(userId, targetType, targetId) {
  if (!Object.keys(TARGET_TABLES).includes(targetType)) {
    return { error: "target_type은 'thread', 'argument', 'reply' 중 하나여야 합니다.", status: 400 };
  }
  if (!targetExists(targetType, targetId)) {
    return { error: "대상을 찾을 수 없습니다.", status: 404 };
  }

  const table = TARGET_TABLES[targetType];
  const target = db.prepare(`SELECT author_id FROM ${table} WHERE id = ?`).get(targetId);
  if (target.author_id === userId) {
    return { error: "본인 글에는 반응할 수 없습니다.", status: 403 };
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM laugh_reactions
       WHERE user_id = ? AND date(created_at) = date('now')`
    )
    .get(userId).count;
  if (todayCount >= DAILY_LAUGH_LIMIT) {
    return { error: `웃기다 반응은 하루 ${DAILY_LAUGH_LIMIT}회까지만 가능합니다.`, status: 429 };
  }

  const existing = db
    .prepare("SELECT id FROM laugh_reactions WHERE target_type = ? AND target_id = ? AND user_id = ?")
    .get(targetType, targetId, userId);

  const tx = db.transaction(() => {
    if (existing) {
      db.prepare("DELETE FROM laugh_reactions WHERE id = ?").run(existing.id);
      return "cancelled";
    }
    const weight = getVoteWeight(userId);
    db.prepare(
      "INSERT INTO laugh_reactions (id, target_type, target_id, user_id, weight) VALUES (?, ?, ?, ?, ?)"
    ).run(randomUUID(), targetType, targetId, userId, weight);
    return "cast";
  });
  const result = tx();

  // 티커 도감은 논제/논증에만 존재한다(21장 관리자 페이지 몫인 수동 티커와 별개) — 대댓글은 대상에서 제외.
  if (result === "cast" && targetType !== "reply") checkAndGrantIngeniousTicker(targetType, targetId);

  const totalWeight = db
    .prepare("SELECT COALESCE(SUM(weight), 0) AS total FROM laugh_reactions WHERE target_type = ? AND target_id = ?")
    .get(targetType, targetId).total;

  return { result, laugh_count: totalWeight };
}

module.exports = { toggleLaugh, DAILY_LAUGH_LIMIT };
