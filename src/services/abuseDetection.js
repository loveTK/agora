const { randomUUID } = require("crypto");
const { db } = require("../db");

// S4에서는 "동일 IP 대량 가입"만 탐지했다. S10은 여기서 한 걸음 더 나가
// "같은 IP에서 여러 계정을 동원해 같은 대상에 몰아주는" 협업형 어뷰징을 탐지한다
// (몰표, 팔로우 몰이, 종교/정당 집단 가입).
const VOTE_BRIGADE_THRESHOLD = 3;   // 같은 논증에 같은 IP로 24h 내 3계정 이상 투표
const FOLLOW_BRIGADE_THRESHOLD = 5; // 같은 대상에 같은 IP로 24h 내 5계정 이상 팔로우
const JOIN_BRIGADE_THRESHOLD = 5;   // 같은 종교/정당에 같은 IP로 24h 내 5계정 이상 가입

// 같은 (type, detail) 조합은 1시간 내 재플래그하지 않는다 — 로그 도배 방지.
function flagOnce(type, detail) {
  const recentDup = db
    .prepare(
      "SELECT id FROM abuse_flags WHERE type = ? AND detail = ? AND created_at >= datetime('now', '-1 hour')"
    )
    .get(type, detail);
  if (recentDup) return;
  db.prepare("INSERT INTO abuse_flags (id, type, detail) VALUES (?, ?, ?)").run(randomUUID(), type, detail);
}

function checkVoteBrigading(argumentId, ip) {
  if (!ip) return;
  const count = db
    .prepare(
      `SELECT COUNT(DISTINCT voter_id) AS count FROM votes
       WHERE argument_id = ? AND ip = ? AND created_at >= datetime('now', '-1 day')`
    )
    .get(argumentId, ip).count;
  if (count >= VOTE_BRIGADE_THRESHOLD) {
    flagOnce("vote_brigading", `argument:${argumentId} ip:${ip} — 동일 IP에서 24시간 내 ${count}개 계정이 투표`);
  }
}

function checkFollowBrigading(followeeId, ip) {
  if (!ip) return;
  const count = db
    .prepare(
      `SELECT COUNT(DISTINCT follower_id) AS count FROM follows
       WHERE followee_id = ? AND ip = ? AND created_at >= datetime('now', '-1 day')`
    )
    .get(followeeId, ip).count;
  if (count >= FOLLOW_BRIGADE_THRESHOLD) {
    flagOnce("follow_brigading", `user:${followeeId} ip:${ip} — 동일 IP에서 24시간 내 ${count}개 계정이 팔로우`);
  }
}

function checkJoinBrigading(table, idColumn, targetId, ip) {
  if (!ip) return;
  const count = db
    .prepare(
      `SELECT COUNT(*) AS count FROM ${table}
       WHERE ${idColumn} = ? AND ip = ? AND joined_at >= datetime('now', '-1 day')`
    )
    .get(targetId, ip).count;
  if (count >= JOIN_BRIGADE_THRESHOLD) {
    flagOnce(
      `${table}_join_brigading`,
      `${idColumn}:${targetId} ip:${ip} — 동일 IP에서 24시간 내 ${count}개 계정이 가입`
    );
  }
}

module.exports = {
  checkVoteBrigading,
  checkFollowBrigading,
  checkJoinBrigading,
  VOTE_BRIGADE_THRESHOLD,
  FOLLOW_BRIGADE_THRESHOLD,
  JOIN_BRIGADE_THRESHOLD,
};
