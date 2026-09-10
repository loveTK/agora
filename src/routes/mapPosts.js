const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth, optionalAuth } = require("../middleware/authMiddleware");
const { containsBannedWord } = require("../services/contentFilter");
const { getVoteWeight } = require("../services/voteWeight");
const { refreshTyrantStatus } = require("../services/tyranny");
const { checkAndGrantFoolTicker } = require("../services/foolTicker");

const router = express.Router();

const BODY_MAX = 300;
const DAILY_MAP_POST_LIMIT = 3; // threads.js DAILY_THREAD_LIMIT과 동일한 취지(스팸성 남발 방지)
const DAILY_MAP_POST_VOTE_LIMIT = 100; // votes.js DAILY_VOTE_LIMIT과 동일한 취지
const VOTE_COLUMN = { up: "upvotes", down: "downvotes", fool: "fool_votes" };

function toSummary(p) {
  return {
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    body_preview: p.body.length > 40 ? `${p.body.slice(0, 40)}…` : p.body,
    upvotes: p.upvotes,
    downvotes: p.downvotes,
    fool_votes: p.fool_votes,
    created_at: p.created_at,
  };
}

// POST /map-posts — body: { lat, lng, body }
router.post("/", requireAuth, (req, res) => {
  const { lat, lng, body } = req.body || {};
  if (
    typeof lat !== "number" || typeof lng !== "number" ||
    Number.isNaN(lat) || Number.isNaN(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return res.status(400).json({ error: "lat/lng가 올바르지 않습니다." });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: "내용을 입력해주세요." });
  }
  if (body.length > BODY_MAX) {
    return res.status(400).json({ error: `내용은 ${BODY_MAX}자 이내로 작성해주세요.` });
  }
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "부적절한 표현이 포함되어 있어 등록할 수 없습니다." });
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM map_posts WHERE author_id = ? AND date(created_at) = date('now')`
    )
    .get(req.userId).count;
  if (todayCount >= DAILY_MAP_POST_LIMIT) {
    return res.status(429).json({
      error: `지도 게시글은 하루 ${DAILY_MAP_POST_LIMIT}건까지만 등록할 수 있습니다. 내일 다시 시도해주세요.`,
    });
  }

  const id = randomUUID();
  db.prepare(
    "INSERT INTO map_posts (id, author_id, lat, lng, body) VALUES (?, ?, ?, ?, ?)"
  ).run(id, req.userId, lat, lng, body.trim());

  const post = db.prepare("SELECT * FROM map_posts WHERE id = ?").get(id);
  res.status(201).json(toSummary(post));
});

// GET /map-posts — 지도 마커 렌더링용 가벼운 목록(좌표+요약)
router.get("/", (req, res) => {
  const posts = db.prepare("SELECT * FROM map_posts ORDER BY created_at DESC").all();
  res.json(posts.map(toSummary));
});

// GET /map-posts/:id — 상세(본문 전체 + 작성자 프로필: 닉네임/계급/보유 티커)
router.get("/:id", optionalAuth, (req, res) => {
  const post = db
    .prepare(
      `SELECT p.*, u.nickname AS author_nickname, u.rank AS author_rank
       FROM map_posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });

  const tickers = db
    .prepare("SELECT DISTINCT ticker FROM user_tickers WHERE user_id = ?")
    .all(post.author_id)
    .map((t) => t.ticker);

  const myVote = req.userId
    ? db
        .prepare("SELECT vote_type FROM map_post_votes WHERE post_id = ? AND voter_id = ?")
        .get(req.params.id, req.userId)
    : null;

  res.json({
    id: post.id,
    author_id: post.author_id,
    author_nickname: post.author_nickname,
    author_rank: post.author_rank,
    author_tickers: tickers,
    lat: post.lat,
    lng: post.lng,
    body: post.body,
    upvotes: post.upvotes,
    downvotes: post.downvotes,
    fool_votes: post.fool_votes,
    created_at: post.created_at,
    my_vote: myVote ? myVote.vote_type : null,
  });
});

// POST /map-posts/:id/vote — body: { vote_type: 'up' | 'down' | 'fool' }
// 정책: 게시글 하나당 유저 하나에 활성 반응 1개만 유지(토글 — 같은 타입 재요청 시 취소).
// 정책: 본인 글 투표 불가, 신규 계정 가중치 적용(voteWeight.js 재사용), 하루 총 횟수 제한.
router.post("/:id/vote", requireAuth, (req, res) => {
  const { vote_type } = req.body || {};
  if (!vote_type || !["up", "down", "fool"].includes(vote_type)) {
    return res.status(400).json({ error: "vote_type은 'up', 'down', 'fool' 중 하나여야 합니다." });
  }

  const post = db.prepare("SELECT * FROM map_posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
  if (post.author_id === req.userId) {
    return res.status(403).json({ error: "본인 게시글에는 반응할 수 없습니다." });
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM map_post_votes
       WHERE voter_id = ? AND date(created_at) = date('now')`
    )
    .get(req.userId).count;
  if (todayCount >= DAILY_MAP_POST_VOTE_LIMIT) {
    return res.status(429).json({ error: `지도 게시글 반응은 하루 ${DAILY_MAP_POST_VOTE_LIMIT}회까지만 가능합니다.` });
  }

  const weight = getVoteWeight(req.userId);
  const existing = db
    .prepare("SELECT * FROM map_post_votes WHERE post_id = ? AND voter_id = ?")
    .get(req.params.id, req.userId);

  const applyDelta = (type, delta) =>
    db
      .prepare(`UPDATE map_posts SET ${VOTE_COLUMN[type]} = ${VOTE_COLUMN[type]} + ? WHERE id = ?`)
      .run(delta, req.params.id);

  // up: 작성자 명성, down: 작성자 비추천 누적(폭군 판정에 연결), fool: 작성자 바보 누적 점수.
  // 셋 다 0 미만으로는 내려가지 않는다(기존 votes.js/laughReaction.js와 동일 원칙).
  const applyAuthorEffect = (type, delta) => {
    if (type === "up") {
      db.prepare("UPDATE users SET reputation = MAX(0, reputation + ?) WHERE id = ?").run(delta, post.author_id);
    } else if (type === "down") {
      db.prepare("UPDATE users SET downvotes_received = MAX(0, downvotes_received + ?) WHERE id = ?").run(
        delta,
        post.author_id
      );
    } else {
      db.prepare("UPDATE users SET fool_score = MAX(0, fool_score + ?) WHERE id = ?").run(delta, post.author_id);
    }
  };

  const tx = db.transaction(() => {
    if (!existing) {
      db.prepare(
        "INSERT INTO map_post_votes (id, post_id, voter_id, vote_type, weight) VALUES (?, ?, ?, ?, ?)"
      ).run(randomUUID(), req.params.id, req.userId, vote_type, weight);
      applyDelta(vote_type, weight);
      applyAuthorEffect(vote_type, weight);
      return "cast";
    }

    if (existing.vote_type === vote_type) {
      db.prepare("DELETE FROM map_post_votes WHERE id = ?").run(existing.id);
      applyDelta(vote_type, -existing.weight);
      applyAuthorEffect(vote_type, -existing.weight);
      return "cancelled";
    }

    db.prepare(
      "UPDATE map_post_votes SET vote_type = ?, weight = ?, created_at = datetime('now') WHERE id = ?"
    ).run(vote_type, weight, existing.id);
    applyDelta(existing.vote_type, -existing.weight);
    applyAuthorEffect(existing.vote_type, -existing.weight);
    applyDelta(vote_type, weight);
    applyAuthorEffect(vote_type, weight);
    return "changed";
  });

  const result = tx();
  refreshTyrantStatus(post.author_id); // 비추천 누적이 바뀌었을 수 있으므로 현재 지배자라면 폭군 판정 재확인
  checkAndGrantFoolTicker(post.author_id); // 바보 누적 점수가 임계치를 넘었으면 이그지니어스 티커 자동 발급

  const updated = db
    .prepare("SELECT upvotes, downvotes, fool_votes FROM map_posts WHERE id = ?")
    .get(req.params.id);
  res.json({ result, vote_type, ...updated });
});

module.exports = router;
