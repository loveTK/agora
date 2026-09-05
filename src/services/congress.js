const { randomUUID } = require("crypto");
const { db } = require("../db");
const { declareWar } = require("./war");

// 기획 문서 16장: 국회력 임계치는 "미확정"이었으나 30명(당원 수)으로 확정했다(전쟁 정족수와 동일 기준 재사용).
const CONGRESS_POWER_THRESHOLD = 30;
const APPROVAL_VOTE_WINDOW_HOURS = 24;
const APPROVAL_RATIO = 0.5; // 과반

// 국회력 = 그 지역 소속 유저 중 정당원인 사람 수 합산 (정당 구분 없이 지역 내 당원 총합)
function regionCongressPower(regionId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM party_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE u.region_id = ?`
    )
    .get(regionId);
  return row.count || 0;
}

// 선전포고 요청의 진입점. 폭군이거나 국회력이 임계치 미만이면 승인 절차 없이 바로 전쟁을 만든다.
// 지배자이면서 국회력이 임계치 이상이면 승인 투표를 먼저 생성한다.
function requestWarDeclaration(attackerUserId, defenderRegionId) {
  const attackerDominance = db.prepare("SELECT * FROM dominance WHERE user_id = ?").get(attackerUserId);
  if (!attackerDominance) {
    return { error: "지배자만 전쟁을 선포할 수 있습니다.", status: 403 };
  }

  const power = regionCongressPower(attackerDominance.region_id);
  const needsApproval = attackerDominance.status === "ruler" && power >= CONGRESS_POWER_THRESHOLD;

  if (!needsApproval) {
    const result = declareWar(attackerUserId, defenderRegionId);
    if (result.error) return result;
    return { war: result.war };
  }

  const id = randomUUID();
  const deadline = db
    .prepare("SELECT datetime('now', ?) AS d")
    .get(`+${APPROVAL_VOTE_WINDOW_HOURS} hours`).d;

  db.prepare(
    `INSERT INTO congress_approvals (id, attacker_region_id, defender_region_id, declared_by, vote_deadline)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, attackerDominance.region_id, defenderRegionId, attackerUserId, deadline);

  return {
    approval: {
      id,
      attacker_region_id: attackerDominance.region_id,
      defender_region_id: defenderRegionId,
      status: "voting",
      vote_deadline: deadline,
      congress_power: power,
    },
  };
}

function getApprovalTally(approvalId) {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN verdict = 'accept' THEN 1 ELSE 0 END) AS accept_votes,
         SUM(CASE WHEN verdict = 'reject' THEN 1 ELSE 0 END) AS reject_votes,
         COUNT(*) AS participant_count
       FROM congress_votes WHERE approval_id = ?`
    )
    .get(approvalId);

  const accept_votes = row.accept_votes || 0;
  const reject_votes = row.reject_votes || 0;
  const participant_count = row.participant_count || 0;
  const accept_ratio = participant_count > 0 ? accept_votes / participant_count : 0;

  return { accept_votes, reject_votes, participant_count, accept_ratio };
}

// 그 지역 당원 전원이 투표를 마쳤으면(=더 기다릴 이유가 없으면) 데드라인 전이라도 바로 확정한다.
function resolveApprovalIfReady(approvalId) {
  const approval = db.prepare("SELECT * FROM congress_approvals WHERE id = ?").get(approvalId);
  if (!approval || approval.status !== "voting") return null;

  const eligible = regionCongressPower(approval.attacker_region_id);
  const tally = getApprovalTally(approvalId);
  if (eligible > 0 && tally.participant_count < eligible) return null;

  return settleApproval(approval, tally);
}

function settleApproval(approval, tally) {
  if (tally.accept_ratio > APPROVAL_RATIO) {
    const result = declareWar(approval.declared_by, approval.defender_region_id);
    if (result.error) {
      // 승인은 됐지만(예: 그 사이 쿨다운 등으로) 실제 선포가 막히면 부결과 동일하게 처리하고 사유를 남긴다.
      db.prepare(
        "UPDATE congress_approvals SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?"
      ).run(approval.id);
      return { ...tally, status: "rejected", reason: result.error };
    }
    db.prepare(
      "UPDATE congress_approvals SET status = 'approved', war_id = ?, resolved_at = datetime('now') WHERE id = ?"
    ).run(result.war.id, approval.id);
    return { ...tally, status: "approved", war: result.war };
  }

  // 부결: 국회가 막은 것이므로 지배자에게 별도 페널티 없음(16.2절)
  db.prepare(
    "UPDATE congress_approvals SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?"
  ).run(approval.id);
  return { ...tally, status: "rejected" };
}

// 배치(하루 1회 전제): 데드라인이 지났는데도 미확정인 승인투표를 확정한다.
function settleExpiredApprovals() {
  const expired = db
    .prepare("SELECT * FROM congress_approvals WHERE status = 'voting' AND vote_deadline < datetime('now')")
    .all();
  const settled = [];
  for (const approval of expired) {
    const tally = getApprovalTally(approval.id);
    settled.push({ id: approval.id, ...settleApproval(approval, tally) });
  }
  return settled;
}

module.exports = {
  CONGRESS_POWER_THRESHOLD,
  APPROVAL_VOTE_WINDOW_HOURS,
  APPROVAL_RATIO,
  regionCongressPower,
  requestWarDeclaration,
  getApprovalTally,
  resolveApprovalIfReady,
  settleExpiredApprovals,
};
