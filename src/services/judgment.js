const { randomUUID } = require("crypto");
const { db } = require("../db");

const QUORUM = 30;              // 최소 참여 인원
const COLLAPSE_THRESHOLD = 0.6; // 붕괴 확정 비율

function getTally(threadId) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN verdict = 'approve' THEN 1 ELSE 0 END) AS approve_votes,
         SUM(CASE WHEN verdict = 'collapse' THEN 1 ELSE 0 END) AS collapse_votes,
         COUNT(*) AS participant_count
       FROM judgment_votes WHERE thread_id = ?`
    )
    .get(threadId);

  const approve_votes = row.approve_votes || 0;
  const collapse_votes = row.collapse_votes || 0;
  const participant_count = row.participant_count || 0;
  const collapse_ratio = participant_count > 0 ? collapse_votes / participant_count : 0;

  return {
    approve_votes,
    collapse_votes,
    participant_count,
    collapse_ratio,
    quorum_met: participant_count >= QUORUM,
    collapse_confirmed: participant_count >= QUORUM && collapse_ratio >= COLLAPSE_THRESHOLD,
  };
}

// 정족수(30명) + 붕괴표(60%) 조건 충족 시 논제를 '붕괴' 확정하고 judgments에 기록.
// 조건 미충족이면 아무 것도 하지 않음(계속 active로 남아 투표가 쌓임).
function settleThread(threadId) {
  const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(threadId);
  if (!thread || thread.status !== "active") return null;

  const tally = getTally(threadId);
  if (!tally.collapse_confirmed) return null;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO judgments (id, thread_id, approve_votes, collapse_votes, participant_count, verdict)
       VALUES (?, ?, ?, ?, ?, 'collapse')`
    ).run(randomUUID(), threadId, tally.approve_votes, tally.collapse_votes, tally.participant_count);

    db.prepare("UPDATE threads SET status = 'collapsed' WHERE id = ?").run(threadId);
  });
  tx();

  return { thread_id: threadId, ...tally };
}

function settleAllActiveThreads() {
  const activeThreads = db.prepare("SELECT id FROM threads WHERE status = 'active'").all();
  const settled = [];
  for (const t of activeThreads) {
    const result = settleThread(t.id);
    if (result) settled.push(result);
  }
  return settled;
}

module.exports = { QUORUM, COLLAPSE_THRESHOLD, getTally, settleThread, settleAllActiveThreads };
