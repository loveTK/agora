const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { recalcRegionRanks } = require("../services/rank");
const { belligerenceTier } = require("../services/belligerence");
const { checkFollowBrigading } = require("../services/abuseDetection");
const { INFLUENCE_THRESHOLD } = require("../services/influence");

const router = express.Router();
const REGION_COOLDOWN_DAYS = 7;

function followerCount(userId) {
  return db.prepare("SELECT COUNT(*) AS count FROM follows WHERE followee_id = ?").get(userId).count;
}

function toPublicUser(u) {
  return {
    id: u.id,
    nickname: u.nickname,
    region_id: u.region_id,
    rank: u.rank,
    reputation: u.reputation,
    belligerence: u.belligerence,
    belligerence_tier: belligerenceTier(u.belligerence),
    follower_count: followerCount(u.id),
    created_at: u.created_at,
  };
}

// GET /users/me
router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
  res.json({ ...toPublicUser(user), email: user.email });
});

// GET /users/:id  (공개 프로필)
router.get("/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
  res.json(toPublicUser(user));
});

// PATCH /users/me/region
// body: { region_id }
// 정책: 지역 변경은 7일 쿨다운 (어뷰징 방지 합의사항 반영)
// 정책: 지역 이동 시 종교/정당 소속은 유지, 계급(rank)·명성(reputation)·지배자 지위는 초기화(지역 종속 자산).
//   - rank, reputation: 즉시 초기화 (구현됨)
//   - 지배자 지위: 이전 지역에 보유 중이던 dominance 레코드를 삭제해 즉시 반납(구현됨, S6)
//   - 이전 지역 선지자 슬롯: 자리가 비므로 다음 순위 후보를 즉시 승급시키도록 재계산(구현됨, S6)
//   - TODO(S9): ITEMS 테이블 도입 시 지배자 전용 망토만 회수 (종교/정당 발급 아이템은 유지)
router.patch("/me/region", requireAuth, (req, res) => {
  const { region_id } = req.body || {};
  if (!region_id) {
    return res.status(400).json({ error: "region_id는 필수입니다." });
  }

  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(region_id);
  if (!region) {
    return res.status(400).json({ error: "존재하지 않는 지역입니다." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  const lastChanged = new Date(user.region_changed_at + "Z").getTime();
  const daysSince = (Date.now() - lastChanged) / (1000 * 60 * 60 * 24);

  if (daysSince < REGION_COOLDOWN_DAYS) {
    const remaining = Math.ceil(REGION_COOLDOWN_DAYS - daysSince);
    return res.status(429).json({
      error: `지역 변경은 ${REGION_COOLDOWN_DAYS}일에 한 번만 가능합니다. ${remaining}일 후 다시 시도해주세요.`,
    });
  }

  const oldRegionId = user.region_id;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET region_id = ?, region_changed_at = datetime('now'), rank = 'citizen', reputation = 0
       WHERE id = ?`
    ).run(region_id, req.userId);

    // 이전 지역에서 지배자였다면 즉시 반납하고, 후보 기록도 정리
    db.prepare("DELETE FROM dominance WHERE region_id = ? AND user_id = ?").run(oldRegionId, req.userId);
    db.prepare("DELETE FROM dominance_candidates WHERE region_id = ? AND user_id = ?").run(
      oldRegionId,
      req.userId
    );
  });
  tx();

  recalcRegionRanks(oldRegionId); // 이 유저가 쓰던 선지자 슬롯이 비었다면 다음 후보를 승급시킴

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json(toPublicUser(updated));
});

// POST /users/:id/follow
router.post("/:id/follow", requireAuth, (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: "자기 자신은 팔로우할 수 없습니다." });
  }
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  const existing = db
    .prepare("SELECT id FROM follows WHERE follower_id = ? AND followee_id = ?")
    .get(req.userId, req.params.id);
  if (existing) return res.status(409).json({ error: "이미 팔로우하고 있습니다." });

  db.prepare("INSERT INTO follows (id, follower_id, followee_id, ip) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    req.userId,
    req.params.id,
    req.ip
  );
  checkFollowBrigading(req.params.id, req.ip);
  res.status(201).json({ following: true, follower_count: followerCount(req.params.id) });
});

// DELETE /users/:id/follow
router.delete("/:id/follow", requireAuth, (req, res) => {
  db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(
    req.userId,
    req.params.id
  );
  res.json({ following: false, follower_count: followerCount(req.params.id) });
});

// GET /users/:id/inventory
// 보유 슬롯 아이템 목록. 지배자 망토(cloak)는 저장된 색상이 아니라 조회 시점의 dominance.status를
// 보고 동적으로 색상을 계산한다 — 폭군 전환/회복 때마다 아이템을 따로 갱신할 필요가 없게 하기 위함.
router.get("/:id/inventory", (req, res) => {
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  const rows = db
    .prepare(
      `SELECT ui.item_id, ui.acquired_at, i.slot_type, i.owner_type, i.owner_id, i.design_asset_url
       FROM user_inventory ui JOIN items i ON i.id = ui.item_id
       WHERE ui.user_id = ?`
    )
    .all(req.params.id);

  const inventory = rows.map((row) => {
    if (row.slot_type !== "cloak" || row.owner_type !== "dominance") return row;

    const dominanceRow = db
      .prepare("SELECT status FROM dominance WHERE region_id = ? AND user_id = ?")
      .get(row.owner_id, req.params.id);
    return { ...row, color: dominanceRow && dominanceRow.status === "tyrant" ? "black" : "default" };
  });

  res.json(inventory);
});

// GET /users/:id/influence
// 타 지역별 영향력 점수, 사상 영향권 도달 지역 목록, 문화 루트 진행도(5곳 도달 시 문화 승리)
router.get("/:id/influence", (req, res) => {
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "유저를 찾을 수 없습니다." });

  const influenceByRegion = db
    .prepare(
      `SELECT i.region_id, r.name AS region_name, i.points
       FROM influence i JOIN regions r ON r.id = i.region_id
       WHERE i.user_id = ? ORDER BY i.points DESC`
    )
    .all(req.params.id);

  const culturalZones = db
    .prepare(
      `SELECT cz.foreign_region_id, r.name AS region_name, cz.achieved_at
       FROM cultural_influence_zones cz JOIN regions r ON r.id = cz.foreign_region_id
       WHERE cz.user_id = ?`
    )
    .all(req.params.id);

  const victory = db.prepare("SELECT * FROM culture_victories WHERE user_id = ?").get(req.params.id);

  res.json({
    influence_by_region: influenceByRegion,
    influence_threshold: INFLUENCE_THRESHOLD,
    cultural_zones: culturalZones,
    culture_route_progress: culturalZones.length,
    culture_victory: !!victory,
  });
});

module.exports = router;
