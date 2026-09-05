const { randomUUID } = require("crypto");
const { db } = require("../db");

// 결제가 확정된(paid) 아이템을 소속 전원(신자/당원)에게 배포한다.
function distributeItem(itemId) {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(itemId);
  if (!item || item.payment_status !== "paid") return;

  let memberIds = [];
  if (item.owner_type === "religion") {
    memberIds = db
      .prepare("SELECT user_id FROM religion_members WHERE religion_id = ?")
      .all(item.owner_id)
      .map((r) => r.user_id);
  } else if (item.owner_type === "party") {
    memberIds = db
      .prepare("SELECT user_id FROM party_members WHERE party_id = ?")
      .all(item.owner_id)
      .map((r) => r.user_id);
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO user_inventory (id, user_id, item_id) VALUES (?, ?, ?)"
  );
  for (const userId of memberIds) insert.run(randomUUID(), userId, itemId);
}

// 신규 가입 시, 그 종교/정당이 이미 배포 확정(paid)한 아이템이 있다면 함께 지급한다.
// (기획 합의사항: "가입 즉시 슬롯 채워짐")
function grantExistingPaidItemsOnJoin(ownerType, ownerId, userId) {
  const items = db
    .prepare("SELECT id FROM items WHERE owner_type = ? AND owner_id = ? AND payment_status = 'paid'")
    .all(ownerType, ownerId);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO user_inventory (id, user_id, item_id) VALUES (?, ?, ?)"
  );
  for (const item of items) insert.run(randomUUID(), userId, item.id);
}

module.exports = { distributeItem, grantExistingPaidItemsOnJoin };
