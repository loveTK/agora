const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { declareWar, getWarTally, resolveWarIfReady, VOTE_QUORUM, APPROVAL_RATIO } = require("../services/war");
const { createBattle, getBattleTally, isWarParticipant, resolveBattle } = require("../services/warBattle");

const router = express.Router();

// POST /wars
// body: { defender_region_id }
// 정책: 선포자는 현재 지배자여야 하며, 상대 지역에도 지배자가 있어야 함.
// 선포 쿨다운(주 1회), 동일 상대 재선포 쿨다운(14일), 병력 격차(3배) 제한 적용.
router.post("/", requireAuth, (req, res) => {
  const { defender_region_id } = req.body || {};
  if (!defender_region_id) {
    return res.status(400).json({ error: "defender_region_id는 필수입니다." });
  }

  const region = db.prepare("SELECT id FROM regions WHERE id = ?").get(defender_region_id);
  if (!region) return res.status(404).json({ error: "존재하지 않는 지역입니다." });

  const result = declareWar(req.userId, defender_region_id);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.status(201).json(result.war);
});

// GET /wars/:id
router.get("/:id", (req, res) => {
  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(req.params.id);
  if (!war) return res.status(404).json({ error: "전쟁을 찾을 수 없습니다." });

  const tally = getWarTally(req.params.id);
  res.json({ ...war, ...tally, quorum: VOTE_QUORUM, approval_ratio: APPROVAL_RATIO });
});

// POST /wars/:id/vote
// body: { verdict: 'accept' | 'reject' }
// 정책: 방어측 지역 시민만 투표 가능(찬반). 1인 1표. 정족수(30명) 도달 시 즉시 결과 확정.
router.post("/:id/vote", requireAuth, (req, res) => {
  const { verdict } = req.body || {};
  if (!verdict || !["accept", "reject"].includes(verdict)) {
    return res.status(400).json({ error: "verdict는 'accept' 또는 'reject'여야 합니다." });
  }

  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(req.params.id);
  if (!war) return res.status(404).json({ error: "전쟁을 찾을 수 없습니다." });
  if (war.status !== "voting") {
    return res.status(409).json({ error: "이미 종료된 투표입니다." });
  }

  const voter = db.prepare("SELECT region_id FROM users WHERE id = ?").get(req.userId);
  if (voter.region_id !== war.defender_region_id) {
    return res.status(403).json({ error: "피선포 지역 시민만 투표할 수 있습니다." });
  }

  const existing = db
    .prepare("SELECT id FROM war_votes WHERE war_id = ? AND voter_id = ?")
    .get(req.params.id, req.userId);
  if (existing) return res.status(409).json({ error: "이미 투표하셨습니다." });

  db.prepare("INSERT INTO war_votes (id, war_id, voter_id, verdict) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    req.params.id,
    req.userId,
    verdict
  );

  const resolved = resolveWarIfReady(req.params.id);
  const tally = getWarTally(req.params.id);

  res.status(201).json({
    ...tally,
    quorum: VOTE_QUORUM,
    approval_ratio: APPROVAL_RATIO,
    war_status: resolved ? resolved.status : "voting",
  });
});

// POST /wars/:id/battle
// body: { title, option_attacker, option_defender }
// 정책: 공격측 지배자(선포자)만 개설 가능. war.status가 'accepted'여야 함.
router.post("/:id/battle", requireAuth, (req, res) => {
  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(req.params.id);
  if (!war) return res.status(404).json({ error: "전쟁을 찾을 수 없습니다." });

  const result = createBattle(war, req.userId, req.body || {});
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.battle);
});

// GET /wars/:id/battle
// 정책: 진행 중(open)일 때는 진영별 집계를 숨긴다(비공개 투표 — 동조 쏠림 방지).
router.get("/:id/battle", (req, res) => {
  const battle = db.prepare("SELECT * FROM war_battles WHERE war_id = ?").get(req.params.id);
  if (!battle) return res.status(404).json({ error: "아직 개설된 전투가 없습니다." });

  if (battle.status === "open") {
    const participantCount = db
      .prepare("SELECT COUNT(DISTINCT user_id) AS count FROM war_battle_choices WHERE battle_id = ?")
      .get(battle.id).count;
    return res.json({
      id: battle.id,
      war_id: battle.war_id,
      title: battle.title,
      option_attacker: battle.option_attacker,
      option_defender: battle.option_defender,
      status: battle.status,
      deadline: battle.deadline,
      participant_count: participantCount, // 진영별 분포는 숨기고 총 참여자 수만 공개
    });
  }

  const tally = getBattleTally(battle.id);
  res.json({ ...battle, ...tally });
});

// POST /wars/:id/battle/choice
// body: { side: 'attacker' | 'defender' }
// 정책: 공격/방어측 지역 시민이면 소속과 무관하게 어느 진영이든 선택 가능(설득력으로 승부).
// 1인 1회만 선택 가능(변경 불가 — 진영 참여는 한 번의 결단으로 취급).
router.post("/:id/battle/choice", requireAuth, (req, res) => {
  const { side } = req.body || {};
  if (!side || !["attacker", "defender"].includes(side)) {
    return res.status(400).json({ error: "side는 'attacker' 또는 'defender'여야 합니다." });
  }

  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(req.params.id);
  if (!war) return res.status(404).json({ error: "전쟁을 찾을 수 없습니다." });
  const battle = db.prepare("SELECT * FROM war_battles WHERE war_id = ?").get(req.params.id);
  if (!battle || battle.status !== "open") {
    return res.status(409).json({ error: "진행 중인 전투가 없습니다." });
  }
  if (!isWarParticipant(req.userId, war)) {
    return res.status(403).json({ error: "이 전쟁에 얽힌 두 지역의 시민만 참여할 수 있습니다." });
  }

  const existing = db
    .prepare("SELECT id FROM war_battle_choices WHERE battle_id = ? AND user_id = ?")
    .get(battle.id, req.userId);
  if (existing) return res.status(409).json({ error: "이미 진영을 선택하셨습니다." });

  db.prepare("INSERT INTO war_battle_choices (id, battle_id, user_id, side) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    battle.id,
    req.userId,
    side
  );
  res.status(201).json({ side });
});

// POST /wars/:id/battle/arguments
// body: { body }
// 정책: 진영 선택을 먼저 해야 논증 등록 가능. 자신이 선택한 진영으로만 등록됨.
router.post("/:id/battle/arguments", requireAuth, (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: "논증 내용을 입력해주세요." });
  }

  const battle = db.prepare("SELECT * FROM war_battles WHERE war_id = ?").get(req.params.id);
  if (!battle || battle.status !== "open") {
    return res.status(409).json({ error: "진행 중인 전투가 없습니다." });
  }

  const choice = db
    .prepare("SELECT side FROM war_battle_choices WHERE battle_id = ? AND user_id = ?")
    .get(battle.id, req.userId);
  if (!choice) {
    return res.status(403).json({ error: "먼저 진영을 선택해야 논증을 등록할 수 있습니다." });
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO war_battle_arguments (id, battle_id, author_id, side, body) VALUES (?, ?, ?, ?, ?)"
  ).run(id, battle.id, req.userId, choice.side, body.trim());

  res.status(201).json({ id, side: choice.side });
});

// POST /wars/:id/battle/arguments/:argId/vote
// body: { vote_type: 'up' | 'down' }
router.post("/:id/battle/arguments/:argId/vote", requireAuth, (req, res) => {
  const { vote_type } = req.body || {};
  if (!vote_type || !["up", "down"].includes(vote_type)) {
    return res.status(400).json({ error: "vote_type은 'up' 또는 'down'이어야 합니다." });
  }

  const war = db.prepare("SELECT * FROM wars WHERE id = ?").get(req.params.id);
  if (!war) return res.status(404).json({ error: "전쟁을 찾을 수 없습니다." });
  const arg = db.prepare("SELECT * FROM war_battle_arguments WHERE id = ?").get(req.params.argId);
  if (!arg) return res.status(404).json({ error: "논증을 찾을 수 없습니다." });
  if (!isWarParticipant(req.userId, war)) {
    return res.status(403).json({ error: "이 전쟁에 얽힌 두 지역의 시민만 투표할 수 있습니다." });
  }
  if (arg.author_id === req.userId) {
    return res.status(403).json({ error: "본인 논증에는 투표할 수 없습니다." });
  }

  const existing = db
    .prepare("SELECT * FROM war_battle_votes WHERE argument_id = ? AND voter_id = ?")
    .get(req.params.argId, req.userId);

  const applyDelta = (col, delta) =>
    db.prepare(`UPDATE war_battle_arguments SET ${col} = ${col} + ? WHERE id = ?`).run(delta, req.params.argId);

  const tx = db.transaction(() => {
    if (!existing) {
      db.prepare(
        "INSERT INTO war_battle_votes (id, argument_id, voter_id, vote_type) VALUES (?, ?, ?, ?)"
      ).run(randomUUID(), req.params.argId, req.userId, vote_type);
      applyDelta(vote_type === "up" ? "upvotes" : "downvotes", 1);
      return "cast";
    }
    if (existing.vote_type === vote_type) {
      db.prepare("DELETE FROM war_battle_votes WHERE id = ?").run(existing.id);
      applyDelta(vote_type === "up" ? "upvotes" : "downvotes", -1);
      return "cancelled";
    }
    db.prepare("UPDATE war_battle_votes SET vote_type = ? WHERE id = ?").run(vote_type, existing.id);
    applyDelta(existing.vote_type === "up" ? "upvotes" : "downvotes", -1);
    applyDelta(vote_type === "up" ? "upvotes" : "downvotes", 1);
    return "changed";
  });

  const result = tx();
  res.json({ result });
});

module.exports = router;
