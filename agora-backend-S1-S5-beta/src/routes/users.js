const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
const REGION_COOLDOWN_DAYS = 7;

function toPublicUser(u) {
  return {
    id: u.id,
    nickname: u.nickname,
    region_id: u.region_id,
    rank: u.rank,
    reputation: u.reputation,
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
//   - TODO(S6): DOMINANCE 테이블 도입 시 보유 중인 지배자/폭군 지위 박탈 + 해당 지역 재공석 처리
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

  db.prepare(
    `UPDATE users
     SET region_id = ?, region_changed_at = datetime('now'), rank = 'citizen', reputation = 0
     WHERE id = ?`
  ).run(region_id, req.userId);

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json(toPublicUser(updated));
});

module.exports = router;
