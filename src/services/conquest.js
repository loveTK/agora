const { randomUUID } = require("crypto");
const { db } = require("../db");
const { followerCount } = require("./userProfile");

// 팔로워 기반 점령: 본인 소속 지역의 인구(소속 유저 수)보다 팔로워 수가 많으면, 7일 연속 생존
// 스트릭(dominance.js) 없이도 즉시 그 지역의 지배자가 될 수 있다. 기존 지배자가 있었다면
// war_battle 패배와 동일하게 실각 처리(dominance_history.ended_reason='conquered')한 뒤 교체한다.
function attemptFollowerConquest(regionId, userId) {
  const user = db.prepare("SELECT id, region_id FROM users WHERE id = ?").get(userId);
  if (!user) return { error: "유저를 찾을 수 없습니다.", status: 404 };
  if (user.region_id !== regionId) {
    return { error: "본인 소속 지역만 점령할 수 있습니다.", status: 403 };
  }

  const population = db.prepare("SELECT COUNT(*) AS count FROM users WHERE region_id = ?").get(regionId).count;
  const followers = followerCount(userId);
  if (followers <= population) {
    return {
      error: `팔로워 수가 소속 인원(${population}명)보다 많아야 점령할 수 있습니다. (현재 팔로워 ${followers}명)`,
      status: 403,
    };
  }

  const existingDominance = db.prepare("SELECT * FROM dominance WHERE region_id = ?").get(regionId);
  if (existingDominance && existingDominance.user_id === userId) {
    return { error: "이미 이 지역의 지배자입니다.", status: 409 };
  }

  const tx = db.transaction(() => {
    if (existingDominance) {
      db.prepare(
        `UPDATE dominance_history SET ended_at = now(), ended_reason = 'conquered'
         WHERE region_id = ? AND user_id = ? AND ended_at IS NULL`
      ).run(regionId, existingDominance.user_id);
      db.prepare("DELETE FROM dominance WHERE id = ?").run(existingDominance.id);
      db.prepare("UPDATE users SET rank = 'citizen', reputation = 0 WHERE id = ?").run(
        existingDominance.user_id
      );
    }

    db.prepare("DELETE FROM dominance_candidates WHERE region_id = ? AND user_id = ?").run(regionId, userId);
    db.prepare("INSERT INTO dominance (id, region_id, user_id, streak_days) VALUES (?, ?, ?, 0)").run(
      randomUUID(),
      regionId,
      userId
    );
    db.prepare("UPDATE regions SET status = 'dominant' WHERE id = ?").run(regionId);
    db.prepare(
      "INSERT INTO dominance_history (id, region_id, user_id, streak_days) VALUES (?, ?, ?, 0)"
    ).run(randomUUID(), regionId, userId);
  });
  tx();

  return { region_id: regionId, user_id: userId, follower_count: followers, population };
}

module.exports = { attemptFollowerConquest };
