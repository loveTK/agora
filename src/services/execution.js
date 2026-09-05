const { randomUUID } = require("crypto");
const { db } = require("../db");

const REVIVAL_COOLDOWN_DAYS = 7; // 처형 후 지배자 후보 자격 박탈 기간 (기획 합의사항)

// 어떤 논제가 붕괴 판정을 받았을 때 호출한다. 그 논제의 작성자가 해당 지역의 현재
// 지배자라면 처형을 집행한다 — 지배자가 아니면 아무 일도 하지 않는다(일반 유저의
// 논제 붕괴는 처형 대상이 아니다).
//
// 처형 시 벌어지는 일:
//   1) dominance_history의 재위 기록 종료(ended_at, ended_reason='executed')
//   2) dominance 테이블에서 지위 삭제
//   3) 지역 상태를 'dispute'로 되돌림 (더 이상 지배자가 없으므로)
//   4) 환생 쿨다운 부여 — 이후 7일간 이 지역에서 다시 지배자가 될 수 없음 (streak은 0으로 리셋)
//   5) 계급(rank)·명성(reputation) 초기화 — 종교/정당 소속, 팔로워, 호전성은 건드리지 않음(유지 정책)
function executeIfRuler(thread) {
  const dominanceRow = db
    .prepare("SELECT * FROM dominance WHERE region_id = ? AND user_id = ?")
    .get(thread.region_id, thread.author_id);
  if (!dominanceRow) return null;

  const cooldownUntil = db
    .prepare("SELECT date('now', '+' || ? || ' days') AS d")
    .get(REVIVAL_COOLDOWN_DAYS).d;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE dominance_history SET ended_at = datetime('now'), ended_reason = 'executed'
       WHERE region_id = ? AND user_id = ? AND ended_at IS NULL`
    ).run(thread.region_id, thread.author_id);

    db.prepare("DELETE FROM dominance WHERE id = ?").run(dominanceRow.id);
    db.prepare("UPDATE regions SET status = 'dispute' WHERE id = ?").run(thread.region_id);

    const existingCandidate = db
      .prepare("SELECT id FROM dominance_candidates WHERE user_id = ? AND region_id = ?")
      .get(thread.author_id, thread.region_id);

    if (existingCandidate) {
      db.prepare(
        "UPDATE dominance_candidates SET streak_days = 0, cooldown_until = ? WHERE id = ?"
      ).run(cooldownUntil, existingCandidate.id);
    } else {
      db.prepare(
        `INSERT INTO dominance_candidates (id, user_id, region_id, streak_days, last_counted_date, cooldown_until)
         VALUES (?, ?, ?, 0, date('now'), ?)`
      ).run(randomUUID(), thread.author_id, thread.region_id, cooldownUntil);
    }

    db.prepare("UPDATE users SET rank = 'citizen', reputation = 0 WHERE id = ?").run(thread.author_id);
  });
  tx();

  return {
    region_id: thread.region_id,
    user_id: thread.author_id,
    thread_id: thread.id,
    cooldown_until: cooldownUntil,
  };
}

module.exports = { executeIfRuler, REVIVAL_COOLDOWN_DAYS };
