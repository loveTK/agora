const { randomUUID } = require("crypto");
const { db } = require("../db");
const { belligerenceTier, WARRIOR_THRESHOLD } = require("./belligerence");

// 무기는 창설자가 디자인하는 게 아니라 시스템이 지급하는 프리셋 하나를 공유한다(기획 합의사항).
function ensureSystemWeaponItem() {
  let item = db
    .prepare("SELECT * FROM items WHERE owner_type = 'system' AND slot_type = 'weapon'")
    .get();
  if (!item) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO items (id, creator_id, owner_type, owner_id, slot_type, payment_status) VALUES (?, NULL, 'system', NULL, 'weapon', 'free')"
    ).run(id);
    item = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  }
  return item;
}

// 호전성이 논전사 티어(100) 이상이면 무기 슬롯을 지급한다. 이미 보유 중이면 아무 것도 하지 않는다.
function grantWeaponIfEligible(userId) {
  const user = db.prepare("SELECT belligerence FROM users WHERE id = ?").get(userId);
  if (!user || belligerenceTier(user.belligerence) === "citizen") return;

  const weaponItem = ensureSystemWeaponItem();
  const already = db
    .prepare("SELECT id FROM user_inventory WHERE user_id = ? AND item_id = ?")
    .get(userId, weaponItem.id);
  if (already) return;

  db.prepare("INSERT INTO user_inventory (id, user_id, item_id) VALUES (?, ?, ?)").run(
    randomUUID(),
    userId,
    weaponItem.id
  );
}

module.exports = { grantWeaponIfEligible, ensureSystemWeaponItem, WARRIOR_THRESHOLD };
