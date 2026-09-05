const { db } = require("../db");

// 지역 상태 계산 규칙 (S4 MVP 버전)
// - contested: 정족수(30명)를 채운 활성 논제가 하나라도 있으면 -> 치열하게 판정 중
// - dispute: 그 외 기본값 -> 아직 큰 이슈 없음
// - dominant: DOMINANCE 테이블(S6)에서 지배자가 등극하면 dominance.js 서비스가 직접 설정한다.
//   이 함수는 dominant 상태를 절대 내리지 않는다 — 이미 dominant인 지역을
//   실수로 되돌리지 않기 위해서다(지배자 교체/축출은 S7 처형 시스템의 역할).
function computeRegionStatus(regionId) {
  const current = db.prepare("SELECT status FROM regions WHERE id = ?").get(regionId);
  if (!current) return null;
  if (current.status === "dominant") return "dominant"; // S6 로직이 담당할 영역, 여기선 건드리지 않음

  const contestedThread = db
    .prepare(
      `SELECT t.id FROM threads t
       WHERE t.region_id = ? AND t.status = 'active'
       AND (SELECT COUNT(*) FROM judgment_votes jv WHERE jv.thread_id = t.id) >= 30
       LIMIT 1`
    )
    .get(regionId);

  return contestedThread ? "contested" : "dispute";
}

// 상태를 재계산하고, 값이 바뀌었으면 DB에 반영 + 소켓으로 실시간 브로드캐스트.
// io가 없으면(테스트 환경 등) 브로드캐스트는 건너뛴다.
function refreshRegionStatus(regionId, io) {
  const newStatus = computeRegionStatus(regionId);
  if (!newStatus) return null;

  const current = db.prepare("SELECT status FROM regions WHERE id = ?").get(regionId);
  if (current.status === newStatus) return newStatus; // 변경 없음 -> 브로드캐스트 불필요

  db.prepare("UPDATE regions SET status = ? WHERE id = ?").run(newStatus, regionId);

  if (io) {
    io.emit("region:update", { region_id: regionId, status: newStatus });
  }
  return newStatus;
}

module.exports = { computeRegionStatus, refreshRegionStatus };
