const { randomUUID } = require("crypto");
const { db } = require("../db");

// XP 지급량 (기획 확정, V1 활성 100명 규모)
const XP_THREAD_CREATE = 5;       // 논제 발의
const XP_ARGUMENT_CREATE = 2;     // 논증 작성
const XP_RECEIVE_UPVOTE = 1;      // 추천을 받음(수신자)
const XP_VOTE_ACTION = 1;         // 추천/비추천/웃기다 등 투표성 행위(행위자 본인)
const XP_WAR_PARTICIPATION = 10;  // 전쟁 참여 (진영 선택 + 논증 등록 완료 시점에 1회)

// 레벨 테이블 — 누적 XP 기준. 값 조정은 이 배열만 고치면 된다.
// title_item_id는 011/021과 동일한 패턴으로 만든 시스템 칭호 아이템(마이그레이션 028 참고)과 매칭된다.
const LEVEL_TABLE = [
  { level: 1, xp: 0, title_item_id: "title_lv1" },
  { level: 2, xp: 20, title_item_id: "title_lv2" },
  { level: 3, xp: 50, title_item_id: "title_lv3" },
  { level: 4, xp: 100, title_item_id: "title_lv4" },
  { level: 5, xp: 200, title_item_id: "title_lv5" },
  { level: 6, xp: 400, title_item_id: "title_lv6" },
  { level: 7, xp: 800, title_item_id: "title_lv7" },
];
const MAX_LEVEL = LEVEL_TABLE[LEVEL_TABLE.length - 1].level;

function levelForXp(xp) {
  let current = LEVEL_TABLE[0];
  for (const row of LEVEL_TABLE) {
    if (xp >= row.xp) current = row;
    else break;
  }
  return current;
}

// 프로필/캐릭터 카드의 XP 진행바에 필요한 정보 — 현재 레벨, 다음 레벨까지 남은 XP(최고 레벨이면 null).
function levelProgress(xp) {
  const current = levelForXp(xp);
  const next = LEVEL_TABLE.find((row) => row.level === current.level + 1);
  return {
    level: current.level,
    xp,
    current_level_xp: current.xp,
    next_level_xp: next ? next.xp : null,
    xp_to_next: next ? next.xp - xp : 0,
  };
}

// 레벨업 시 그 레벨의 칭호(title 슬롯) 아이템을 자동 지급 + 착용. title 슬롯은 한 번에 하나만
// 착용 가능하므로 기존에 착용 중이던 하위 레벨 칭호는 자동으로 해제된다.
function grantTitleForLevel(userId, level) {
  const row = LEVEL_TABLE.find((r) => r.level === level);
  if (!row) return;
  const itemId = row.title_item_id;

  const owned = db.prepare("SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ?").get(userId, itemId);
  if (!owned) {
    db.prepare("INSERT INTO user_inventory (id, user_id, item_id) VALUES (?, ?, ?)").run(
      randomUUID(),
      userId,
      itemId
    );
  }
  db.prepare(
    `UPDATE user_inventory SET equipped = 0
     WHERE user_id = ? AND equipped = 1 AND item_id IN (SELECT id FROM items WHERE slot_type = 'title')`
  ).run(userId);
  db.prepare("UPDATE user_inventory SET equipped = 1 WHERE user_id = ? AND item_id = ?").run(userId, itemId);
}

// XP를 지급하고, 레벨이 올랐으면(한 번에 여러 레벨을 건너뛸 수도 있음) 그만큼 칭호를 순서대로 지급한다.
// 반환값은 프론트의 "+N XP" 팝업/레벨업 연출에 그대로 쓸 수 있게 구성했다.
function grantXp(userId, amount, reason) {
  const user = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId);
  if (!user) return null;

  const levelBefore = levelForXp(user.xp).level;
  const newXp = user.xp + amount;
  db.prepare("UPDATE users SET xp = ? WHERE id = ?").run(newXp, userId);
  const levelAfter = levelForXp(newXp).level;

  const tx = db.transaction(() => {
    for (let lv = levelBefore + 1; lv <= levelAfter; lv++) grantTitleForLevel(userId, lv);
  });
  if (levelAfter > levelBefore) tx();

  const progress = levelProgress(newXp);
  return {
    reason,
    amount,
    xp: newXp,
    level_before: levelBefore,
    level_after: levelAfter,
    leveled_up: levelAfter > levelBefore,
    xp_current_level: progress.current_level_xp,
    xp_next_level: progress.next_level_xp,
    xp_to_next: progress.xp_to_next,
  };
}

module.exports = {
  XP_THREAD_CREATE,
  XP_ARGUMENT_CREATE,
  XP_RECEIVE_UPVOTE,
  XP_VOTE_ACTION,
  XP_WAR_PARTICIPATION,
  LEVEL_TABLE,
  MAX_LEVEL,
  levelForXp,
  levelProgress,
  grantXp,
};
