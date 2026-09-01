const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { getVoteWeight } = require("../services/voteWeight");

const router = express.Router();
const DAILY_VOTE_LIMIT = 100; // 어뷰징 방지: 하루 추천/비추천 총 횟수 상한

// POST /arguments/:id/vote
// body: { vote_type: 'up' | 'down' }
// 정책: 1계정 1논증 1표, 본인 글 본인 투표 불가. 같은 타입 재요청 시 취소(토글) 처리.
// 정책: 신규 계정은 투표 가중치가 낮다(voteWeight 서비스 참고).
// 정책: 하루 100회로 투표 총 횟수 제한(취소/변경도 소진 — 반복 토글로 우회 방지).
router.post("/:id/vote", requireAuth, (req, res) => {
  const { vote_type } = req.body || {};
  if (!vote_type || !["up", "down"].includes(vote_type)) {
    return res.status(400).json({ error: "vote_type은 'up' 또는 'down'이어야 합니다." });
  }

  const arg = db.prepare("SELECT * FROM arguments WHERE id = ?").get(req.params.id);
  if (!arg) return res.status(404).json({ error: "논증을 찾을 수 없습니다." });
  if (arg.author_id === req.userId) {
    return res.status(403).json({ error: "본인 논증에는 투표할 수 없습니다." });
  }

  const todayVoteActions = db
    .prepare(
      `SELECT COUNT(*) AS count FROM votes
       WHERE voter_id = ? AND date(created_at) = date('now')`
    )
    .get(req.userId).count;
  if (todayVoteActions >= DAILY_VOTE_LIMIT) {
    return res.status(429).json({ error: `투표는 하루 ${DAILY_VOTE_LIMIT}회까지만 가능합니다.` });
  }

  const weight = getVoteWeight(req.userId);
  const existing = db
    .prepare("SELECT * FROM votes WHERE argument_id = ? AND voter_id = ?")
    .get(req.params.id, req.userId);

  const applyDelta = (col, delta) =>
    db.prepare(`UPDATE arguments SET ${col} = ${col} + ? WHERE id = ?`).run(delta, req.params.id);

  const tx = db.transaction(() => {
    if (!existing) {
      db.prepare(
        "INSERT INTO votes (id, argument_id, voter_id, vote_type, weight) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), req.params.id, req.userId, vote_type, weight);
      applyDelta(vote_type === "up" ? "upvotes" : "downvotes", weight);
      return "cast";
    }

    if (existing.vote_type === vote_type) {
      // 같은 타입 재클릭 -> 취소
      db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
      applyDelta(vote_type === "up" ? "upvotes" : "downvotes", -existing.weight);
      return "cancelled";
    }

    // 다른 타입으로 변경
    db.prepare(
      "UPDATE votes SET vote_type = ?, weight = ?, created_at = datetime('now') WHERE id = ?"
    ).run(vote_type, weight, existing.id);
    applyDelta(existing.vote_type === "up" ? "upvotes" : "downvotes", -existing.weight);
    applyDelta(vote_type === "up" ? "upvotes" : "downvotes", weight);
    return "changed";
  });

  const result = tx();
  const updated = db.prepare("SELECT * FROM arguments WHERE id = ?").get(req.params.id);
  res.json({ result, weight, upvotes: updated.upvotes, downvotes: updated.downvotes });
});

module.exports = router;
