// AGORA V3 시즌 운영 — 8주 주기(SEASON_WEEKS). 리셋 대상(지배권/기여/저항/공격로그)과 영구 보존
// 대상(챔피언 아카이브, 창립자 타이틀)을 분리한다(기획 5절, dominance_history 패턴 재사용).
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { SEASON_WEEKS } = require("./neighborhoodConquest");

function getCurrentSeason() {
  let season = db
    .prepare("SELECT * FROM neighborhood_seasons WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1")
    .get();
  if (!season) {
    const id = randomUUID();
    db.prepare("INSERT INTO neighborhood_seasons (id) VALUES (?)").run(id);
    season = db.prepare("SELECT * FROM neighborhood_seasons WHERE id = ?").get(id);
  }
  return season;
}

// 카운트다운 오버레이용 — 시작 시각 + SEASON_WEEKS로부터 남은 일수를 계산한다(별도 타이머 없이 즉석 계산).
function getSeasonProgress() {
  const season = getCurrentSeason();
  const startedAt = new Date(season.started_at.replace(" ", "T") + "Z");
  const endsAt = new Date(startedAt.getTime() + SEASON_WEEKS * 7 * 24 * 60 * 60 * 1000);
  const msRemaining = Math.max(0, endsAt.getTime() - Date.now());
  return {
    season_id: season.id,
    started_at: season.started_at,
    ends_at: endsAt.toISOString(),
    days_remaining: Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
    season_weeks: SEASON_WEEKS,
  };
}

// 관리자 전용(내부 배치, /internal 하위 requireAdmin으로 보호됨).
// 각 동의 현재 지배자를 챔피언으로 영구 기록한 뒤, 지배권/기여/저항/공격로그를 초기화하고
// 전부 status='npc'로 되돌린다 — 창립자 타이틀(neighborhood_founders)은 건드리지 않는다.
function settleSeason() {
  const season = getCurrentSeason();

  const dominated = db
    .prepare("SELECT * FROM neighborhoods WHERE status != 'npc' AND dominant_user_id IS NOT NULL")
    .all();

  const tx = db.transaction(() => {
    for (const n of dominated) {
      const totalPoints = db
        .prepare("SELECT COALESCE(SUM(points), 0) AS total FROM neighborhood_contributions WHERE neighborhood_id = ?")
        .get(n.id).total;
      db.prepare(
        "INSERT INTO neighborhood_season_champions (id, season_id, neighborhood_id, user_id, final_points) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), season.id, n.id, n.dominant_user_id, totalPoints);
    }

    db.prepare("UPDATE neighborhoods SET status = 'npc', dominant_user_id = NULL").run();
    db.prepare("DELETE FROM neighborhood_contributions").run();
    db.prepare("DELETE FROM neighborhood_resistance").run();
    db.prepare("DELETE FROM neighborhood_attacks").run();

    db.prepare("UPDATE neighborhood_seasons SET ended_at = now() WHERE id = ?").run(season.id);
    db.prepare("INSERT INTO neighborhood_seasons (id) VALUES (?)").run(randomUUID());
  });
  tx();

  return { champions_recorded: dominated.length, previous_season_id: season.id };
}

module.exports = { getCurrentSeason, getSeasonProgress, settleSeason };
