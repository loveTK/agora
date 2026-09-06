const express = require("express");
const { randomUUID } = require("crypto");
const { db } = require("../db");
const { requireAuth } = require("../middleware/authMiddleware");
const { getVoteWeight } = require("../services/voteWeight");
const { recalcRank } = require("../services/rank");
const { refreshTyrantStatus } = require("../services/tyranny");
const { checkVoteBrigading } = require("../services/abuseDetection");
const { isReputationGainBlocked } = require("../services/war");
const { applyInfluenceDelta } = require("../services/influence");
const { toggleLaugh } = require("../services/laughReaction");
const { containsBannedWord } = require("../services/contentFilter");

const router = express.Router();
const DAILY_VOTE_LIMIT = 100; // 어뷰징 방지: 하루 추천/비추천 총 횟수 상한
const REPLY_BODY_MAX = 300; // threads.js의 BODY_MAX와 동일한 기준

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

  // 추천(up)은 명성 +delta, 비추천(down)은 명성 -delta로 반영한다(0 미만으로는 내려가지 않음).
  // 명성은 시민->지지자->선지자 승급의 기준이 되므로, 논증에 대한 반응이 바로 계급에 영향을 준다.
  // 전쟁 회피로 "굴복 상태"에 놓인 지역의 지배자는 명성 획득(양수 델타)만 막힌다(S11) — 손실은 그대로 반영.
  const applyReputationDelta = (delta) => {
    if (delta > 0 && isReputationGainBlocked(arg.author_id)) return;
    db.prepare("UPDATE users SET reputation = MAX(0, reputation + ?) WHERE id = ?").run(delta, arg.author_id);
  };

  // 영향력(문화 루트, S13): 이 논증이 달린 논제가 작성자 소속 지역이 아닌 "타 지역"의 논제라면,
  // 추천/비추천에 따라 그 지역에서의 영향력이 오르내린다. applyInfluenceDelta 내부에서
  // 자기 소속 지역이면 자동으로 무시하므로 별도 분기 없이 항상 호출해도 안전하다.
  const argThread = db.prepare("SELECT region_id FROM threads WHERE id = ?").get(arg.thread_id);
  const applyInfluence = (delta) => applyInfluenceDelta(arg.author_id, argThread.region_id, delta);

  // 폭군 판정용 누적치: 논증이 비추천을 받을 때마다 작성자의 downvotes_received가 오르내린다
  // (가중치 반영, 0 미만으로는 내려가지 않음). refreshTyrantStatus는 트랜잭션 밖에서 마지막에 호출한다.
  const applyDownvotesReceivedDelta = (delta) =>
    db
      .prepare("UPDATE users SET downvotes_received = MAX(0, downvotes_received + ?) WHERE id = ?")
      .run(delta, arg.author_id);

  // 지지자 수치(명성) 적립: 추천 버튼을 누르는 행위 자체도 투표자 본인에게 +1 (기획 합의사항).
  // 가중치 없이 정수 1로 고정 — 콘텐츠 품질과 무관하게 "참여" 자체에 대한 보상이기 때문.
  const applyVoterReputationDelta = (delta) =>
    db
      .prepare("UPDATE users SET reputation = MAX(0, reputation + ?) WHERE id = ?")
      .run(delta, req.userId);

  const tx = db.transaction(() => {
    if (!existing) {
      db.prepare(
        "INSERT INTO votes (id, argument_id, voter_id, vote_type, weight, ip) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(randomUUID(), req.params.id, req.userId, vote_type, weight, req.ip);
      applyDelta(vote_type === "up" ? "upvotes" : "downvotes", weight);
      applyReputationDelta(vote_type === "up" ? weight : -weight);
      applyInfluence(vote_type === "up" ? weight : -weight);
      if (vote_type === "down") applyDownvotesReceivedDelta(weight);
      if (vote_type === "up") applyVoterReputationDelta(1);
      return "cast";
    }

    if (existing.vote_type === vote_type) {
      // 같은 타입 재클릭 -> 취소
      db.prepare("DELETE FROM votes WHERE id = ?").run(existing.id);
      applyDelta(vote_type === "up" ? "upvotes" : "downvotes", -existing.weight);
      applyReputationDelta(vote_type === "up" ? -existing.weight : existing.weight);
      applyInfluence(vote_type === "up" ? -existing.weight : existing.weight);
      if (vote_type === "down") applyDownvotesReceivedDelta(-existing.weight);
      if (vote_type === "up") applyVoterReputationDelta(-1);
      return "cancelled";
    }

    // 다른 타입으로 변경
    db.prepare(
      "UPDATE votes SET vote_type = ?, weight = ?, created_at = datetime('now'), ip = ? WHERE id = ?"
    ).run(vote_type, weight, req.ip, existing.id);
    applyDelta(existing.vote_type === "up" ? "upvotes" : "downvotes", -existing.weight);
    applyDelta(vote_type === "up" ? "upvotes" : "downvotes", weight);
    // 명성도 기존 방향을 되돌리고 새 방향을 적용
    applyReputationDelta(existing.vote_type === "up" ? -existing.weight : existing.weight);
    applyReputationDelta(vote_type === "up" ? weight : -weight);
    applyInfluence(existing.vote_type === "up" ? -existing.weight : existing.weight);
    applyInfluence(vote_type === "up" ? weight : -weight);
    // 비추천 누적치도 기존 방향을 되돌리고 새 방향을 적용
    if (existing.vote_type === "down") applyDownvotesReceivedDelta(-existing.weight);
    if (vote_type === "down") applyDownvotesReceivedDelta(weight);
    // 투표자 본인의 지지자 수치도 up<->down 전환에 맞춰 조정
    if (existing.vote_type === "up") applyVoterReputationDelta(-1);
    if (vote_type === "up") applyVoterReputationDelta(1);
    return "changed";
  });

  const result = tx();
  recalcRank(arg.author_id); // 작성자 명성 변화가 계급(지지자/선지자 슬롯)에 영향을 줄 수 있으므로 재계산
  if (req.userId !== arg.author_id) recalcRank(req.userId); // 투표자 본인의 명성도 바뀌었으므로 재계산
  refreshTyrantStatus(arg.author_id); // 작성자가 현재 지배자라면 폭군 전환 여부 재판정
  if (result === "cast") checkVoteBrigading(req.params.id, req.ip); // 신규 투표일 때만 몰표 패턴 탐지
  const updated = db.prepare("SELECT * FROM arguments WHERE id = ?").get(req.params.id);
  res.json({ result, weight, upvotes: updated.upvotes, downvotes: updated.downvotes });
});

// POST /arguments/:id/laugh
// 논제(thread)와 동일한 토글/가중치/이그지니어스 로직을 논증(argument)에도 그대로 적용한다.
router.post("/:id/laugh", requireAuth, (req, res) => {
  const result = toggleLaugh(req.userId, "argument", req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

// POST /arguments/:id/replies — body: { body }
// 정책: 대댓글은 찬반 구분 없이 자유 형식 한 줄 답글. 로그인만 요구(본인 글 제한 없음 — 자기 논증에 스스로
// 부연 설명을 다는 것도 자연스러운 사용 패턴이라 votes/laugh와 달리 본인 제한을 두지 않는다).
router.post("/:id/replies", requireAuth, (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: "답글 내용을 입력해주세요." });
  }
  if (body.length > REPLY_BODY_MAX) {
    return res.status(400).json({ error: `답글은 ${REPLY_BODY_MAX}자 이내로 작성해주세요.` });
  }
  if (containsBannedWord(body)) {
    return res.status(400).json({ error: "부적절한 표현이 포함되어 있어 등록할 수 없습니다." });
  }

  const arg = db.prepare("SELECT id FROM arguments WHERE id = ?").get(req.params.id);
  if (!arg) return res.status(404).json({ error: "논증을 찾을 수 없습니다." });

  const id = randomUUID();
  db.prepare(
    "INSERT INTO argument_replies (id, argument_id, author_id, body) VALUES (?, ?, ?, ?)"
  ).run(id, req.params.id, req.userId, body.trim());

  const reply = db.prepare("SELECT * FROM argument_replies WHERE id = ?").get(id);
  res.status(201).json(reply);
});

// GET /arguments/:id/replies
router.get("/:id/replies", (req, res) => {
  const arg = db.prepare("SELECT id FROM arguments WHERE id = ?").get(req.params.id);
  if (!arg) return res.status(404).json({ error: "논증을 찾을 수 없습니다." });

  const replies = db
    .prepare(
      `SELECT r.*, u.nickname AS author_nickname,
              COALESCE((SELECT SUM(CASE WHEN vote_type = 'up' THEN weight ELSE 0 END)
                          FROM reply_votes WHERE reply_id = r.id), 0) AS upvotes,
              COALESCE((SELECT SUM(CASE WHEN vote_type = 'down' THEN weight ELSE 0 END)
                          FROM reply_votes WHERE reply_id = r.id), 0) AS downvotes,
              COALESCE((SELECT SUM(weight) FROM laugh_reactions
                          WHERE target_type = 'reply' AND target_id = r.id), 0) AS laugh_count
       FROM argument_replies r JOIN users u ON u.id = r.author_id
       WHERE r.argument_id = ?
       ORDER BY r.created_at ASC`
    )
    .all(req.params.id);

  res.json(replies);
});

module.exports = router;
