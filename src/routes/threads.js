const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { getTally, settleThread, QUORUM, COLLAPSE_THRESHOLD } = require("../services/judgment");
const { refreshRegionStatus } = require("../services/regionStatus");
const { containsBannedWord } = require("../services/contentFilter");
const { THREAD_BELLIGERENCE_POINTS, ARGUMENT_BELLIGERENCE_POINTS } = require("../services/belligerence");
const { grantWeaponIfEligible } = require("../services/weapon");
const { toggleLaugh } = require("../services/laughReaction");

const DAILY_JUDGMENT_VOTE_LIMIT = 20; // 어뷰징 방지: 하루 20개 논제까지만 판정투표 가능

const router = express.Router();

const TITLE_MAX = 50;
const BODY_MAX = 300;
const DAILY_THREAD_LIMIT = 3; // 스팸성 남발 방지 (기획 합의사항)

function toPublicThread(t) {
  return {
    id: t.id,
    region_id: t.region_id,
    author_id: t.author_id,
    title: t.title,
    body: t.body,
    status: t.status,
    created_at: t.created_at,
  };
}

// POST /threads
// body: { region_id, title, body? }
router.post("/", requireAuth, (req, res) => {
  const { region_id, title, body } = req.body || {};

  if (!region_id || !title) {
    return res.status(400).json({ error: "region_id, title은 필수입니다." });
  }
  if (title.length > TITLE_MAX) {
    return res.status(400).json({ error: `제목은 ${TITLE_MAX}자 이내로 작성해주세요.` });
  }
  if (body && body.length > BODY_MAX) {
    return res.status(400).json({ error: `부연 설명은 ${BODY_MAX}자 이내로 작성해주세요.` });
  }
  if (containsBannedWord(title) || containsBannedWord(body)) {
    return res.status(400).json({ error: "부적절한 표현이 포함되어 있어 등록할 수 없습니다." });
  }

  const region = db.prepare("SELECT * FROM regions WHERE id = ?").get(region_id);
  if (!region) {
    return res.status(400).json({ error: "존재하지 않는 지역입니다." });
  }
  // 전쟁 패배로 점령된 지역은 일정 기간 신규 논제 등록이 제한된다(S12, 문서 6.2절 "점령 상태").
  if (region.thread_ban_until && region.thread_ban_until > new Date().toISOString()) {
    return res.status(403).json({
      error: `이 지역은 점령 상태로 신규 논제 등록이 제한되어 있습니다. (해제: ${region.thread_ban_until})`,
    });
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM threads
       WHERE author_id = ? AND date(created_at) = date('now')`
    )
    .get(req.userId).count;

  if (todayCount >= DAILY_THREAD_LIMIT) {
    return res.status(429).json({
      error: `논제는 하루 ${DAILY_THREAD_LIMIT}개까지만 등록할 수 있습니다. 내일 다시 시도해주세요.`,
    });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO threads (id, region_id, author_id, title, body)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, region_id, req.userId, title, body || null);

  // 호전성 게이지: 논제 발의 1건당 +2 (기획 합의사항)
  db.prepare("UPDATE users SET belligerence = belligerence + ? WHERE id = ?").run(
    THREAD_BELLIGERENCE_POINTS,
    req.userId
  );
  grantWeaponIfEligible(req.userId); // 논전사 티어(100) 이상이면 무기 슬롯 자동 지급

  const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(id);
  res.status(201).json(toPublicThread(thread));
});

// GET /threads/:id
router.get("/:id", (req, res) => {
  const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(req.params.id);
  if (!thread || thread.hidden) return res.status(404).json({ error: "논제를 찾을 수 없습니다." });

  const argCount = db
    .prepare("SELECT COUNT(*) AS count FROM arguments WHERE thread_id = ?")
    .get(req.params.id).count;

  res.json({ ...toPublicThread(thread), argument_count: argCount });
});

// POST /threads/:id/arguments
// body: { stance: 'pro' | 'con', body: string }
router.post("/:id/arguments", requireAuth, (req, res) => {
  const { stance, body } = req.body || {};
  if (!stance || !["pro", "con"].includes(stance)) {
    return res.status(400).json({ error: "stance는 'pro' 또는 'con'이어야 합니다." });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ error: "논증 내용을 입력해주세요." });
  }
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "부적절한 표현이 포함되어 있어 등록할 수 없습니다." });
  }

  const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(req.params.id);
  if (!thread || thread.hidden) return res.status(404).json({ error: "논제를 찾을 수 없습니다." });
  if (thread.status !== "active") {
    return res.status(409).json({ error: "이미 종료된 논제에는 논증을 등록할 수 없습니다." });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO arguments (id, thread_id, author_id, stance, body)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, req.params.id, req.userId, stance, body.trim());

  // 호전성 게이지: 답글(논증) 등록 1건당 +1 (기획 합의사항)
  db.prepare("UPDATE users SET belligerence = belligerence + ? WHERE id = ?").run(
    ARGUMENT_BELLIGERENCE_POINTS,
    req.userId
  );
  grantWeaponIfEligible(req.userId); // 논전사 티어(100) 이상이면 무기 슬롯 자동 지급

  const arg = db.prepare("SELECT * FROM arguments WHERE id = ?").get(id);
  res.status(201).json(arg);
});

// GET /threads/:id/arguments
router.get("/:id/arguments", (req, res) => {
  const thread = db.prepare("SELECT id FROM threads WHERE id = ?").get(req.params.id);
  if (!thread) return res.status(404).json({ error: "논제를 찾을 수 없습니다." });

  const args = db
    .prepare(
      `SELECT a.*, u.nickname AS author_nickname
       FROM arguments a JOIN users u ON u.id = a.author_id
       WHERE a.thread_id = ? AND a.hidden = 0
       ORDER BY a.created_at ASC`
    )
    .all(req.params.id);

  res.json(args);
});

// POST /threads/:id/judgment-vote
// body: { verdict: 'approve' | 'collapse' }
// 정책: 1계정 1논제 1표. 투표 즉시 정족수/임계값 충족 여부를 검사해 충족되면 바로 확정한다.
// (기획 문서상 "24시간 배치 정산"은 대량 트래픽 시 부하 분산용 최적화이며,
//  MVP 단계에서는 즉시 판정해도 로직상 동일한 결과를 보장한다.)
router.post("/:id/judgment-vote", requireAuth, (req, res) => {
  const { verdict } = req.body || {};
  if (!verdict || !["approve", "collapse"].includes(verdict)) {
    return res.status(400).json({ error: "verdict는 'approve' 또는 'collapse'여야 합니다." });
  }

  const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(req.params.id);
  if (!thread) return res.status(404).json({ error: "논제를 찾을 수 없습니다." });
  if (thread.status !== "active") {
    return res.status(409).json({ error: "이미 판정이 종료된 논제입니다." });
  }

  const existing = db
    .prepare("SELECT id FROM judgment_votes WHERE thread_id = ? AND voter_id = ?")
    .get(req.params.id, req.userId);
  if (existing) {
    return res.status(409).json({ error: "이미 이 논제에 판정 투표를 하셨습니다." });
  }

  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM judgment_votes
       WHERE voter_id = ? AND date(created_at) = date('now')`
    )
    .get(req.userId).count;
  if (todayCount >= DAILY_JUDGMENT_VOTE_LIMIT) {
    return res.status(429).json({
      error: `판정 투표는 하루 ${DAILY_JUDGMENT_VOTE_LIMIT}개 논제까지만 참여할 수 있습니다.`,
    });
  }

  db.prepare(
    "INSERT INTO judgment_votes (id, thread_id, voter_id, verdict) VALUES (?, ?, ?, ?)"
  ).run(randomUUID(), req.params.id, req.userId, verdict);

  const settled = settleThread(req.params.id, req.app.get("io"));
  const tally = getTally(req.params.id);

  // 정족수 도달/판정 결과에 따라 지역 상태(dispute/contested)가 바뀔 수 있으므로
  // 즉시 재계산하고, 값이 바뀌면 지도 화면에 실시간으로 반영한다(Socket.io).
  refreshRegionStatus(thread.region_id, req.app.get("io"));

  res.status(201).json({
    ...tally,
    quorum: QUORUM,
    collapse_threshold: COLLAPSE_THRESHOLD,
    thread_status: settled ? "collapsed" : "active",
  });
});

// GET /threads/:id/judgment
// 현재 판정 투표 현황 (정족수 미달 시 판정 보류 상태로 표시)
router.get("/:id/judgment", (req, res) => {
  const thread = db.prepare("SELECT status FROM threads WHERE id = ?").get(req.params.id);
  if (!thread) return res.status(404).json({ error: "논제를 찾을 수 없습니다." });

  const tally = getTally(req.params.id);
  res.json({
    ...tally,
    quorum: QUORUM,
    collapse_threshold: COLLAPSE_THRESHOLD,
    thread_status: thread.status,
    pending: !tally.quorum_met,
  });
});

// POST /threads/:id/laugh
// 정책: 토글(재요청 시 취소), 본인 글 불가, 신규 계정 가중치 적용(voteWeight 재사용).
// 이 논제의 웃기다 가중치 합산이 임계값을 넘으면 작성자에게 "이그지니어스" 티커가 자동 발급된다.
router.post("/:id/laugh", requireAuth, (req, res) => {
  const result = toggleLaugh(req.userId, "thread", req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

module.exports = router;
