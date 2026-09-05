const { randomUUID } = require("crypto");
const { db } = require("../db");
const { QUORUM } = require("./judgment");

const RULER_STREAK_REQUIRED = 7; // 7일 연속 무패 시 지배자 등극 (기획 합의사항)

// 하루 1회(cron) 호출을 전제로 한 배치 함수. 같은 날 여러 번 불러도 중복 반영되지 않는다
// (dominance_candidates.last_counted_date로 날짜별 1회만 반영되도록 막아둠).
//
// 판정 방식: 오늘 시점에 "정족수(30명)를 채우고도 아직 붕괴되지 않은" 활성 논제를 가진 유저를
// 그 지역의 '오늘의 생존자'로 본다. 생존자는 streak +1, 그렇지 않으면 streak을 0으로 리셋한다.
// streak이 7에 도달하고 해당 지역에 아직 지배자가 없으면 그 유저가 지배자로 등극한다.
// 단, 환생 쿨다운(cooldown_until) 중인 후보는 streak 요건을 채웠어도 등극할 수 없다(S7).
function settleDominance() {
  const today = db.prepare("SELECT date('now') AS d").get().d;

  const survivors = db
    .prepare(
      `SELECT DISTINCT t.author_id AS user_id, t.region_id
       FROM threads t
       WHERE t.status = 'active'
       AND (SELECT COUNT(*) FROM judgment_votes jv WHERE jv.thread_id = t.id) >= ?`
    )
    .all(QUORUM);

  const survivorKeys = new Set(survivors.map((s) => `${s.user_id}:${s.region_id}`));

  // 기존 후보들의 streak 갱신 (오늘 이미 처리됐으면 건너뛰어 하루 1회만 반영되게 함)
  const existingCandidates = db.prepare("SELECT * FROM dominance_candidates").all();
  for (const c of existingCandidates) {
    if (c.last_counted_date === today) continue;
    const key = `${c.user_id}:${c.region_id}`;
    const survived = survivorKeys.has(key);
    const newStreak = survived ? c.streak_days + 1 : 0;
    db.prepare(
      "UPDATE dominance_candidates SET streak_days = ?, last_counted_date = ? WHERE id = ?"
    ).run(newStreak, today, c.id);
    survivorKeys.delete(key); // 처리 완료
  }

  // 오늘 처음 등장한 생존자는 새 후보로 등록
  for (const key of survivorKeys) {
    const [user_id, region_id] = key.split(":");
    db.prepare(
      `INSERT INTO dominance_candidates (id, user_id, region_id, streak_days, last_counted_date)
       VALUES (?, ?, ?, 1, ?)`
    ).run(randomUUID(), user_id, region_id, today);
  }

  // streak 7 이상 + 해당 지역에 지배자가 아직 없으면 등극 (환생 쿨다운 중이면 제외)
  const ready = db
    .prepare(
      `SELECT * FROM dominance_candidates
       WHERE streak_days >= ? AND (cooldown_until IS NULL OR cooldown_until <= date('now'))`
    )
    .all(RULER_STREAK_REQUIRED);

  const crowned = [];
  for (const c of ready) {
    const existingRuler = db.prepare("SELECT id FROM dominance WHERE region_id = ?").get(c.region_id);
    if (existingRuler) continue;

    db.prepare(
      "INSERT INTO dominance (id, region_id, user_id, streak_days) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), c.region_id, c.user_id, c.streak_days);
    db.prepare("UPDATE regions SET status = 'dominant' WHERE id = ?").run(c.region_id);

    // 명예의 전당용 재위 기록 시작 (처형되면 ended_at/ended_reason이 채워짐 — execution.js 참고)
    db.prepare(
      "INSERT INTO dominance_history (id, region_id, user_id, streak_days) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), c.region_id, c.user_id, c.streak_days);

    crowned.push({ region_id: c.region_id, user_id: c.user_id });
  }

  return { candidates_checked: existingCandidates.length, crowned };
}

module.exports = { settleDominance, RULER_STREAK_REQUIRED };
