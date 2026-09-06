const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { toggleReplyVote } = require("../services/replyVote");
const { toggleLaugh } = require("../services/laughReaction");

const router = express.Router();

// POST /replies/:id/vote — body: { vote_type: 'up' | 'down' }
router.post("/:id/vote", requireAuth, (req, res) => {
  const { vote_type } = req.body || {};
  const result = toggleReplyVote(req.userId, req.params.id, vote_type);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// POST /replies/:id/laugh
router.post("/:id/laugh", requireAuth, (req, res) => {
  const result = toggleLaugh(req.userId, "reply", req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

module.exports = router;
