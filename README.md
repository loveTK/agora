# AGORA — S1~S13 스프린트

스프린트표 기준 **S1~S13** 구현체입니다. S13에서 문화 루트(사상 전파)가 핫 아젠다·영향력 시스템으로 구현됩니다.

## 포함된 기능

**S1**
- 회원가입 / 로그인 (JWT 발급)
- 지역 배정 (가입 시 필수 선택)
- 지역 변경 (7일 쿨다운 정책 적용)
- 지역 목록 조회 (지도 렌더링용 경량 API)
- DB 초기 스키마: `regions`, `users`

**S2**
- 논제(질문) 등록 — 제목 50자/설명 300자 제한, 1인 1일 3개 등록 한도
- 논제 상세 조회 (논증 수 포함)
- 논증(찬/반) 등록 — 종료된 논제엔 등록 불가
- 논제별 논증 목록 조회
- 지역별 논제 목록 조회 (`GET /regions/:id/threads`)
- DB 스키마 추가: `threads`, `arguments`

**S3**
- 논증 추천/비추천 투표 — 1계정 1논증 1표, 같은 타입 재클릭 시 취소(토글), 본인 글 투표 불가
- 판정 투표(성립/붕괴) — 1계정 1논제 1표
- **정족수 30명 + 붕괴표 60%** 충족 시 즉시 논제 '붕괴' 확정 → `judgments`에 기록, 논제 상태를 `collapsed`로 전환
- 붕괴된 논제는 이후 논증/판정투표 등록 불가
- `POST /internal/judgments/settle` — 배치 정산용 보정 엔드포인트 (운영 환경에서는 내부망/관리자 토큰으로 보호 필요)
- DB 스키마 추가: `votes`, `judgment_votes`, `judgments`

> 기획 문서상 "24시간 배치 정산"은 대량 트래픽 상황의 부하 분산용 최적화 여지로 남겨두고,
> MVP는 투표 즉시 정족수/임계값을 검사해 확정하는 방식으로 구현했습니다(최종 결과는 동일).
> 실제 배치가 필요해지면 `POST /internal/judgments/settle`을 cron으로 주기 호출하면 됩니다.

**S4**
- 지도 실시간 연동 — Socket.io 도입. 판정투표로 정족수(30명) 도달 시 지역 상태를 `dispute → contested`로 자동 전환하고 `region:update` 이벤트로 즉시 브로드캐스트
  - `dominant` 상태는 아직 다루지 않음(S6에서 DOMINANCE 테이블과 함께 구현 예정) — 한 번 dominant가 된 지역은 이 로직이 되돌리지 않도록 방어 처리
- 어뷰징 방지 1차
  - 신규 계정 투표 가중치 하향: 가입 3일 미만 0.3배, 7일 미만 0.6배, 그 이상 1.0배 (추천/비추천에만 적용, 판정투표는 정족수 개념 보호를 위해 1인 1표 유지)
  - 하루 투표 총량 제한: 추천/비추천 100회, 판정투표 20개 논제
  - 다중 계정 의심 탐지: 같은 IP에서 24시간 내 5건 이상 가입 시 `abuse_flags`에 기록(자동 차단은 하지 않고 관리자 검토용으로만 사용)
- DB 스키마 추가: `votes.weight`, `users.signup_ip`, `abuse_flags`

**S5**
- 콘텐츠 필터 1차 — 논제/논증 등록 시 `banned_words` 목록에 포함된 표현이면 즉시 거부
  - 시드 데이터는 필터 '메커니즘'을 보여주기 위한 자리표시자일 뿐이며, 실제 배포 전 CX/법무가 검토한 진짜 목록으로 교체해야 함
- 신고(`POST /reports`) — thread/argument/user 대상, 사유 필수
- 자동 숨김(그림자 제한) — 동일 대상에 대기(pending) 신고가 5건 누적되면 즉시 숨김 처리(최종 판단 아님, 관리자 검토 전까지 임시 조치)
- 관리자 신고 처리 — `GET/PATCH /internal/reports`로 목록 조회 및 `dismissed`(숨김 해제)/`actioned`(영구 숨김)/`reviewed`(보류) 처리
- 숨김된 콘텐츠는 목록·상세 조회에서 제외(상세는 404로 응답, 존재 여부를 노출하지 않음)
- **`/internal/*` 전체에 관리자 인증 적용** — 헤더 `x-admin-token`이 `ADMIN_TOKEN` 환경변수와 일치해야 접근 가능 (기존 배치 정산·어뷰징 로그 조회 포함)
- DB 스키마 추가: `reports`, `banned_words`, `threads.hidden`, `arguments.hidden`

**S6**
- 계급 자동 승급 — 논증이 추천/비추천을 받을 때마다 작성자의 명성(reputation)이 가중치만큼 오르내림(0 미만으로는 안 내려감)
  - 명성 50 이상: 지지자(follower) / 200 이상: 선지자(prophet) 후보
  - **선지자는 지역당 3자리 한정 슬롯** — 명성 상위 3명만 유지, 새 후보가 진입하면 최하위가 자동 강등(선점 경쟁 재현)
  - 지역 이동 시 명성·계급 초기화는 기존 그대로, 이번엔 **떠난 자리의 선지자 슬롯이 즉시 다음 후보에게 넘어가도록** 재계산 추가
- 지배자(7일 연속 무패) — `dominance_candidates`로 지역별 '오늘 정족수를 채우고도 안 무너진 논제를 가진 유저'를 매일 추적, streak 7일 도달 시 `dominance` 테이블에 등극 + 지역 상태 `dominant`로 전환
  - `POST /internal/dominance/settle` — 하루 1회 cron 호출 전제의 배치 정산(관리자 인증 필요)
  - 이미 지배자가 있는 지역의 교체·축출(처형)은 S7에서 구현 완료 — `services/execution.js` 참고
- DB 스키마 추가: `dominance_candidates`, `dominance`

**S6 확장 (용어 정리 + 호전성 + 폭군)**
- **용어 정리**: 계급명 "지지자"의 DB 내부 키를 `follower` → `supporter`로 변경 (팔로우 기능의 `follower`와 명확히 구분). 기존 데이터는 마이그레이션으로 자동 이관됨
- **호전성(belligerence) 게이지** — 논제 발의 +2, 답글(논증) 등록 +1로 누적. 별도의 "다작 논객" 뱃지는 따로 두지 않고 이 게이지 하나로 발언량 기여를 대표(기획 확정: 통합)
  - 티어: 100 이상 `warrior`(논전사), 300 이상 `elite_warrior`(정예 논전사) — `belligerence_tier`로 API에 노출, 무기 슬롯 지급 로직은 S9에서 연결 예정
- **지지자 수치(명성) 확장** — 기존에는 "내 글이 추천받으면" 명성이 올랐는데, 이제 "내가 추천 버튼을 누르는 행위" 자체도 투표자 본인에게 명성 +1 (가중치 무관, 참여 자체에 대한 보상). 취소/전환 시 대칭적으로 반영
- **폭군(tyrant) 상태** — 지배자에 한해 적용. 비추천 누적(`downvotes_received`) 100 이상 **+** 본인 콘텐츠에 대한 관리자 승인 신고(`actioned`) 3건 이상을 동시 충족하면 `dominance.status`가 `ruler` → `tyrant`로 전환(회복하면 다시 `ruler`로 복귀). 지배자가 아닌 일반 유저에게는 적용하지 않음(검정 망토 연출이 지배자 전용이므로)
- DB 스키마 추가: `users.belligerence`, `users.downvotes_received`
- 개발 중 SQLite 부작용 하나 발견해 수정: `ALTER TABLE ... RENAME TO`가 기본적으로 다른 테이블의 FK 참조까지 자동으로 고쳐써서, 재생성 후 테이블을 지우면 참조가 깨지는 문제 → 마이그레이션에 `PRAGMA legacy_alter_table=ON` 추가로 해결

**운영팀 공식 시드 콘텐츠**
- 가짜 계정으로 활동을 위장하지 않고, 닉네임에 "AGORA 운영팀"임을 명시한 단일 공식 계정으로 오픈 전 콘텐츠를 투명하게 채운다
- 서버 시작 시(`seedIfEmpty`) 계정이 없으면 자동 생성 + 시드 논제 30개를 전체 지역(23장 확장 후 19곳)에 고르게 분산 게시
- 멱등성 보장 — 재시작해도 중복 생성되지 않음(계정은 이메일로, 논제는 게시 개수로 확인 후 스킵)
- 최초 생성 시 서버 콘솔 로그에 임시 비밀번호가 1회 출력됨 — 반드시 별도로 기록해둘 것(재출력 안 됨)

**S7**
- 처형 연출 트리거 — 지배자의 논제가 붕괴 판정을 받는 순간(`settleThread` 내부) 자동 발동
  - 지배 지위 즉시 반납, 지역 상태 재계산(다른 활성 논제가 없으면 dispute로, 있으면 그 상태에 맞게 자동 재계산)
  - **환생 쿨다운(7일)** 부여 — 쿨다운 중에는 무패 streak을 다시 채워도 재등극 불가, 해제 후에는 정상적으로 재등극 가능
  - 계급(rank)→citizen, 명성(reputation)→0으로 초기화. 종교/정당 소속·팔로워·호전성은 그대로 유지(기존 지역 이동 초기화 정책과 동일한 원칙)
  - Socket.io `region:execution` 이벤트로 실시간 브로드캐스트(연출 트리거용)
- 명예의 전당 — `dominance_history`에 지배자 등극~퇴위 전 재위 기록을 영구 보존. `GET /hall-of-fame`으로 역대 최장 재위 지배자 + 현재 선지자 랭킹 조회
- DB 스키마 추가: `dominance_candidates.cooldown_until`, `dominance_history`

**S8**
- 팔로우 기능 — `POST/DELETE /users/:id/follow`, 유저 프로필에 `follower_count` 노출 (정당 창설 조건의 선행 요구사항이라 이번 스프린트에서 함께 구현)
- 종교 창설/가입 — 창설 조건: 명성 500 이상. 교리는 본인이 작성한 논제 3~5개로 구성(타인 논제 지정 불가). 1인 1종교 — 새로 가입하면 기존 소속에서 자동 탈퇴
- 정당 창설/가입 — 창설 조건: 팔로워 100명 이상. 강령(텍스트) 필수. 1인 1정당, 종교와 동일한 자동 전환 규칙
- 창설자는 자동으로 첫 신자/당원이 됨
- 국교화(신자 비율 90%), 당론 투표, 지지율 랭킹은 아직 미구현 — 창설·가입까지가 이번 스프린트 범위
- DB 스키마 추가: `follows`, `religions`, `religion_tenets`, `religion_members`, `parties`, `party_members`

**S9**
- 아이템 슬롯 4종 — 악세사리(종교 발급) / 뱃지(정당 발급) / 망토(지배자 발급, 무료) / 무기(시스템 발급, 논전사 티어 자동 지급)
- 종교/정당 아이템: 창설자가 등록(`POST /religions|parties/:id/items`) → 모의 결제 체크아웃 → 결제 확정 시 소속 전원에게 자동 배포, 이후 신규 가입자도 가입 즉시 자동 지급
- **모의 결제 시스템** — 실제 PG(결제대행사) 연동 전까지 쓰는 자리표시자. `POST /items/:id/checkout`으로 세션 생성, `POST /internal/payments/:sessionId/confirm`(관리자 전용, 실제로는 PG 웹훅이 대체할 자리)으로 확정. 운영 전환 시 이 두 지점만 교체하면 됨
- 지배자 망토는 결제 없이 무료 발급, 재위 기간당 1회만 가능
- **망토 색상은 저장하지 않고 조회 시점에 동적으로 계산** — 지배자면 `default`, 폭군이면 `black`. 폭군 전환/회복이 일어나도 아이템을 따로 갱신할 필요가 없음
- 무기는 창설자 디자인이 아니라 시스템이 발급하는 프리셋 하나를 전원이 공유 — 호전성 100(논전사 티어) 달성 시 자동 지급
- DB 스키마 추가: `items`, `user_inventory`, `payment_sessions`

**S10**
- 협업형(다중계정) 어뷰징 탐지 — S4의 "동일 IP 대량 가입" 탐지에 이어, "같은 IP에서 여러 계정을 동원해 같은 대상에 몰아주는" 패턴을 탐지
  - 몰표(vote_brigading): 같은 논증에 동일 IP로 24시간 내 3개 이상 계정이 투표
  - 팔로우 몰이(follow_brigading): 같은 유저에게 동일 IP로 24시간 내 5개 이상 계정이 팔로우
  - 종교/정당 집단 가입(religion_members_join_brigading / party_members_join_brigading): 동일 IP로 24시간 내 5개 이상 계정이 같은 종교/정당에 가입
  - 전부 `abuse_flags`에 기록(자동 차단 아님, 관리자 검토용 — 기존 원칙과 동일). 동일 유형·상세는 1시간 내 중복 기록하지 않음(로그 도배 방지)
- DB 스키마 추가: `votes.ip`, `follows.ip`, `religion_members.ip`, `party_members.ip`

**S11**
- 병력 환산 — 지역 병력 = 그 지역 주민 전원의 팔로워 수 합계(`GET /regions/:id/military-power`)
- 선전포고(`POST /wars`) — 선포 자격: 현재 지배자만. 검증 항목:
  - 상대 지역에도 지배자가 있어야 함(무주공산 지역 선포 불가)
  - 자기 지역 선포 불가
  - 선포 쿨다운 7일(지배자당), 동일 상대 재선포 쿨다운 14일
  - **병력 격차 제한(3배)** — 방어측 병력이 0이어도 예외 없이 적용(가장 취약한 지역이 오히려 무방비했던 버그를 개발 중 자체 발견해 수정함)
- 수락 투표(`POST /wars/:id/vote`) — 방어측 지역 시민만 투표(찬/반), 정족수(30명) 도달 즉시 판정 확정(24시간 데드라인은 정족수 미달 시의 안전장치 역할)
  - 과반 찬성 → `accepted`(실제 전투는 S12에서 처리)
  - 과반 거부(회피) → `avoided`. 방어측 지배자 명성 −50, 방어측 지역에 7일간 **굴복 상태**(`submission_until`) 부여
  - **굴복 상태 동안 그 지역 지배자는 명성 획득(양수 델타)이 차단됨** — 비추천으로 인한 손실은 그대로 반영(`votes.js`에 통합)
- `POST /internal/wars/settle` — 하루 1회 배치. 데드라인 경과 + 정족수 미달 전쟁을 `void` 처리(패널티 없음, 재선포 가능)
- DB 스키마 추가: `wars`, `war_votes`, `regions.submission_until`

**S12**
- 전투 방식: **진영 선택형 논쟁** — `accepted` 상태의 전쟁에서 공격측 지배자(선포자)만 전투 개설 가능(`POST /wars/:id/battle`, 논제+공격측 주장+방어측 주장 2개 제시)
  - 참여 자격: 공격측·방어측 두 지역 시민만(소속과 무관하게 어느 진영이든 선택 가능 — "설득력으로 승부") — 이 전쟁과 무관한 제3지역 유저는 참여 불가
  - 진영 선택(`POST .../battle/choice`) → 선택한 진영으로만 논증 등록(`POST .../battle/arguments`) → 투표(`POST .../battle/arguments/:argId/vote`)
  - **비공개 집계** — 전투 진행 중(open)에는 진영별 득표가 API에 노출되지 않고 총 참여자 수만 공개(동조 쏠림 방지). 확정(settled) 후에만 전체 공개
  - 판정: 추천수 총합이 더 높은 진영이 승리. 동점이면 방어측 승리(임의 타이브레이크, 정식 규칙 미확정)
  - `POST /internal/wars/battles/settle` — 하루 1회 배치, 마감(48시간) 경과 시 자동 확정
- **영토 점령** — 승리측이 패배 지역에 점령 상태 부여(실제 인구 이동은 하지 않음, 문서 6.2절과 일치)
  - `regions.occupied_until`(7일), `regions.thread_ban_until`(3일) — 점령 중엔 신규 논제 등록 실제로 차단됨(`threads.js`에 통합)
  - 패배 지역에 지배자가 있었다면 실각(처형과 유사하게 계급·명성 초기화, `dominance_history.ended_reason='conquered'`로 기록)
  - **미구현/보류**: "판정 투표 가중치 하락"은 기존 판정 시스템의 1인 1표 원칙(정족수 개념 보호)과 충돌해 이번 스프린트에서는 반영하지 않음 — 별도 설계 논의 필요
- 전쟁 인센티브 — 승리측 지배자 명성 +200, 승리 진영에서 논증을 실제로 작성한 유저만 명성 +5(투표만 한 사람은 제외, 무임승차 방지)
- DB 스키마 추가: `war_battles`, `war_battle_choices`, `war_battle_arguments`, `war_battle_votes`, `regions.occupied_until`, `regions.thread_ban_until`, `dominance_history.ended_reason`에 `'conquered'` 추가

**S13**
- 핫 아젠다 대시보드(`GET /hot-agenda`) — 지역 소속과 무관하게 전체 활성 논제를 참여도(추천 합·논증 수) 기준으로 노출. "폴리스 탐험"(내 지역 논제만)과 구분되는 별도 화면
- 영향력(Influence) 시스템 — 자기 소속이 아닌 **타 지역** 논제에서 논증이 추천/비추천을 받을 때마다 그 지역에서의 영향력이 오르내림(자기 지역 활동은 대상 아님, 기존 명성/호전성으로 이미 보상되므로)
  - 임계값(50) 도달 시 그 지역이 "사상 영향권"으로 인정되어 `cultural_influence_zones`에 영구 기록
  - 사상 영향권 지역이 **5곳**에 도달하면 "문화 승리" 달성 — `culture_victories`에 1인 1회 기록
  - **주의**: 문화 승리는 달성 사실만 영구 기록하며, 실제 버전(시즌) 전환 등 세계 지배 효과는 아직 구현되지 않음(기획 문서 14장 버전 시스템이 먼저 코드로 구현되어야 함)
- 조회 API: `GET /users/:id/influence`(내 영향력·문화 루트 진행도), `GET /regions/:id/cultural-influence`(이 지역의 사상 영향권 보유자 목록)
- DB 스키마 추가: `influence`, `cultural_influence_zones`, `culture_victories`

**S16 (국회 견제 시스템)**
- 국회력 = 선포측 지역 소속 정당원 수 합산(`regionCongressPower`, `src/services/congress.js`)
- 지배자(폭군 아님)의 국회력이 **30명** 이상이면 선전포고 시 즉시 전쟁이 생성되지 않고, 자기 지역 정당원 대상 승인 투표(24시간, 과반)가 먼저 생성됨 — `POST /wars`가 이 경우 `202`로 `congress_approvals` 레코드를 반환
  - 폭군이거나 국회력이 30명 미만이면 승인 절차 없이 기존 플로우 그대로 즉시 선포
  - 승인 가결 시 그 시점에 실제 전쟁 생성(기존 `declareWar` 재사용), 부결 시 선포만 무산되고 페널티 없음
- API: `GET /congress-approvals/:id`, `POST /congress-approvals/:id/vote`, `POST /internal/congress-approvals/settle`(하루 1회 배치, 데드라인 경과분 확정)
- DB 스키마 추가: `congress_approvals`, `congress_votes`
- **미확정 사항 그대로 남김**(기획 문서 16.4절): 국회 승인투표가 반복 부결될 때의 재시도 쿨다운은 아직 없음(현재는 기존 선포 쿨다운 7일/14일만 적용됨)

## 기술 스택
- Node.js + Express
- SQLite (better-sqlite3) — 베타 단계용. 운영 전환 시 `src/db.js`만 PostgreSQL 드라이버로 교체하면 됩니다(쿼리는 표준 SQL).
- JWT 인증 (jsonwebtoken) + bcrypt 비밀번호 해싱

## 계급(rank) 값 변경 안내
`rank` 필드의 값은 `citizen` / `supporter` / `prophet`입니다 (예전 문서·클라이언트 코드에 `follower`로 되어 있다면 `supporter`로 갱신하세요).

## 실행 방법
```bash
npm install
cp .env.example .env
npm run seed     # 초기 지역 19곳(기존 6곳 + 23장 확장 13곳) 시드 — 기존 배포에 재실행해도 새 지역만 추가됨(INSERT OR IGNORE)
npm start        # http://localhost:4000
```

> **Render 무료 티어처럼 Shell 접근이 안 되는 환경 배포 시**: `npm run seed`를 따로 실행할 필요가 없습니다.
> 서버가 시작될 때 지역 데이터가 비어있으면 자동으로 시드합니다(`seedIfEmpty`, `src/index.js`에서 호출).
> 이미 데이터가 있으면 건너뛰므로 재배포·재시작해도 중복 삽입되지 않습니다.

## 지역 이동 시 초기화 정책
지역을 옮기면(`PATCH /users/me/region`) 아래와 같이 처리됩니다.

| 유지 | 초기화 |
|---|---|
| 종교/정당 소속 (S8 예정) | 계급(rank) → citizen |
| | 명성(reputation) → 0 |
| | (S6 예정) 지배자/폭군 지위 — 이전 지역 것은 자동 반납 |
| | (S9 예정) 지배자 전용 망토 아이템 — 회수 |

즉 "신념/조직 소속"은 지역과 무관한 정체성으로 보아 유지하고, "그 지역에서 쌓은 실적"은 지역 종속 자산으로 보아 초기화합니다.
새 스키마(`schema_migrations` 테이블)로 마이그레이션이 서버 재시작 시 중복 실행되지 않도록 추적합니다.

## API 목록

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| GET | /health | 서버 상태 확인 | - |
| POST | /auth/signup | 회원가입 (email, password, nickname, region_id) | - |
| POST | /auth/login | 로그인 (email, password) | - |
| GET | /users/me | 내 정보 조회 | 필요 |
| GET | /users/:id | 공개 프로필 조회 | - |
| PATCH | /users/me/region | 지역 변경 (7일 쿨다운) | 필요 |
| GET | /regions | 전체 지역 목록 (지도용) | - |
| GET | /regions/:id | 지역 상세 (인구수 포함) | - |
| GET | /regions/:id/threads | 지역별 논제 목록 | - |
| POST | /threads | 논제 등록 (region_id, title, body?) | 필요 |
| GET | /threads/:id | 논제 상세 | - |
| POST | /threads/:id/arguments | 논증 등록 (stance, body) | 필요 |
| GET | /threads/:id/arguments | 논제별 논증 목록 | - |
| POST | /arguments/:id/vote | 논증 추천/비추천 (vote_type) | 필요 |
| POST | /threads/:id/judgment-vote | 판정 투표 (verdict: approve/collapse) | 필요 |
| GET | /threads/:id/judgment | 판정 현황 조회 (정족수·비율) | - |
| POST | /internal/judgments/settle | 배치 정산 보정 | 관리자 |
| GET | /internal/abuse/flags | 이상 탐지 로그 조회 | 관리자 |
| POST | /reports | 신고 접수 (target_type, target_id, reason) | 필요 |
| GET | /internal/reports | 신고 목록 (?status=pending 등) | 관리자 |
| PATCH | /internal/reports/:id | 신고 처리 (reviewed/dismissed/actioned) | 관리자 |
| GET | /regions/:id/dominance | 지역 지배자 및 상위 후보 조회 | - |
| POST | /internal/dominance/settle | 지배자 배치 정산 (하루 1회) | 관리자 |
| GET | /hall-of-fame | 역대 지배자 재위 기록 + 현재 선지자 랭킹 | - |
| POST/DELETE | /users/:id/follow | 팔로우 / 언팔로우 | 필요 |
| POST | /religions | 종교 창설 (name, tenet_thread_ids) | 필요 |
| GET | /religions/:id | 종교 상세(교리, 신자 수) | - |
| POST | /religions/:id/join | 종교 가입 | 필요 |
| POST | /parties | 정당 창설 (name, platform) | 필요 |
| GET | /parties/:id | 정당 상세(당원 수) | - |
| POST | /parties/:id/join | 정당 가입 | 필요 |
| POST | /religions/:id/items | 종교 아이템(악세사리) 등록 | 필요(창설자만) |
| POST | /parties/:id/items | 정당 아이템(뱃지) 등록 | 필요(창설자만) |
| GET | /items/:id | 아이템 상세 | - |
| POST | /items/:id/checkout | 모의 결제 세션 생성(15,000원) | 필요(아이템 창설자만) |
| POST | /internal/payments/:sessionId/confirm | 결제 확정(모의, 실제 PG 웹훅 대체 자리) | 관리자 |
| POST | /regions/:id/dominance/cloak | 지배자 전용 망토 발급(무료) | 필요(현재 지배자만) |
| GET | /users/:id/inventory | 보유 아이템 목록(망토는 폭군 상태에 따라 색상 동적 계산) | - |
| POST | /wars | 선전포고 (defender_region_id) | 필요(현재 지배자만) |
| GET | /wars/:id | 전쟁 상세(투표 현황) | - |
| POST | /wars/:id/vote | 수락 투표 (accept/reject) | 필요(방어측 시민만) |
| GET | /regions/:id/military-power | 지역 병력(팔로워 합계) 조회 | - |
| GET | /regions/:id/wars | 지역이 얽힌 전쟁 목록 | - |
| POST | /internal/wars/settle | 전쟁 배치 정산(정족수 미달 무효처리) | 관리자 |
| POST | /wars/:id/battle | 전투 개설 (title, option_attacker, option_defender) | 필요(공격측 지배자만) |
| GET | /wars/:id/battle | 전투 조회(진행 중엔 집계 비공개) | - |
| POST | /wars/:id/battle/choice | 진영 선택 (side) | 필요(관련 지역 시민만) |
| POST | /wars/:id/battle/arguments | 전투 논증 등록 | 필요(진영 선택 후) |
| POST | /wars/:id/battle/arguments/:argId/vote | 전투 논증 투표 | 필요(관련 지역 시민만) |
| POST | /internal/wars/battles/settle | 전투 배치 정산(마감 경과 자동 확정) | 관리자 |
| GET | /hot-agenda | 전 지역 논제 대시보드(참여도순) | - |
| GET | /users/:id/influence | 영향력 현황 + 문화 루트 진행도 | - |
| GET | /regions/:id/cultural-influence | 이 지역의 사상 영향권 보유자 목록 | - |

인증이 필요한 요청은 헤더에 `Authorization: Bearer <token>`을 포함하세요.
관리자 전용(`/internal/*`) 요청은 헤더에 `x-admin-token: <ADMIN_TOKEN>`을 포함하세요. 기본값은 `.env`의 `ADMIN_TOKEN`이며, 운영 배포 전 반드시 강력한 값으로 교체하세요.

## 실제 결제 연동 시 교체할 지점
- `src/routes/items.js`의 `checkout_url`을 실제 PG(예: 토스페이먼츠, 포트원 등)의 결제 페이지 URL로 교체
- `src/routes/internal.js`의 `POST /payments/:sessionId/confirm`을 PG 웹훅 핸들러로 교체(서명 검증 포함, 관리자 토큰 대신 PG 고유의 검증 방식 사용)
- 나머지 로직(아이템 배포, 인벤토리 지급)은 그대로 재사용 가능

## 실시간 이벤트 (Socket.io)
클라이언트는 `http://localhost:4000`에 Socket.io로 접속 후 아래 이벤트를 구독하면 됩니다.
```js
const socket = io("http://localhost:4000");
socket.on("region:update", ({ region_id, status }) => {
  // 지도 마커 색상 갱신
});
socket.on("region:execution", ({ region_id, user_id, cooldown_until }) => {
  // 처형 연출 트리거
});
```

## 다음 스프린트(S14)에서 이어 붙일 것
- ~~모바일 앱 착수~~ → `mobile/` 참고 (React Native + Expo, 웹과 같은 API 재사용)
- 문화 승리 이후의 실제 효과(버전/시즌 전환) — 기획 문서 14장 버전 시스템 구현 필요
- 전쟁 관련 미확정 사항: 판정 투표 가중치 하락(점령 페널티), 승리 진영 한정판 아이템 지급(현재는 명성 보너스만 지급)

## 모바일 앱 (S14)
`mobile/` — Expo(React Native + TypeScript) 프로젝트, 백엔드는 웹과 동일한 `api.myagora.xyz`를 그대로 씀(별도 모바일 전용 API 없음).

착수 범위: 로그인/회원가입 + Hot Issue 목록까지만 구현. 나머지 화면(지도, 세력, 전쟁 등)은 웹의 `agora.html` 로직을 참고해 이어 붙이면 됨.

```bash
cd mobile
npm install
npm run ios      # 또는 android — Xcode/Android Studio 필요
npm run web       # 시뮬레이터 없이 빠르게 미리보기
```

토큰 저장은 네이티브에서 `expo-secure-store`, 웹 미리보기에서는 `localStorage`로 자동 전환됨.

## 배포 (AWS Lightsail)

기존에는 백엔드를 Render 무료 티어에 배포했으나, 무료 티어는 Persistent Disk를 지원하지 않아
서버가 재시작될 때마다 SQLite 데이터가 초기화되는 문제가 있었다. AWS Lightsail 인스턴스는
기본적으로 영구 SSD 스토리지를 제공하므로 이 문제를 해결한다.

### 구성
- Lightsail 인스턴스 (Ubuntu 22.04, 최소 사양 $3.5~5/월 플랜으로 충분)
- Node.js 22 + PM2 (프로세스 관리, 재부팅 시 자동 기동) — `better-sqlite3` 최신 버전이 Node 22 이상을 요구하므로, 그보다 낮은 버전에서는 DB를 여는 순간 세그폴트가 발생함
- Nginx 리버스 프록시 (80/443 → 4000, Socket.io WebSocket 업그레이드 포함)
- Let's Encrypt(certbot)로 HTTPS
- SQLite 파일은 인스턴스 로컬 디스크에 저장 (`data/agora.db`) — Lightsail 자동 스냅샷으로 백업 권장
- 프론트엔드(`agora.html`)는 Netlify에 배포, API는 `api.myagora.xyz` 서브도메인으로 분리

### 최초 배포
1. Lightsail 콘솔에서 Ubuntu 22.04 인스턴스 생성, 고정 IP(Static IP) 연결
2. 방화벽(Networking 탭)에서 80, 443만 공개, 4000은 막아둔다 (Nginx를 통해서만 접근)
3. SSH 접속 후:
   ```bash
   git clone https://github.com/loveTK/agora.git ~/agora
   cd ~/agora
   bash deploy/setup.sh
   ```
4. `.env`의 `JWT_SECRET`, `ADMIN_TOKEN`을 실제 운영 값으로 교체 후 `pm2 restart agora-api`
5. 도메인 연결 후: `sudo certbot --nginx -d <도메인>`

### 이후 배포 (CD)
`.github/workflows/deploy-lightsail.yml`이 `main` 브랜치 push 시 SSH로 접속해
`git pull` → `npm ci` → `pm2 restart`를 자동 수행한다. 아래 GitHub Secrets 등록 필요:
- `LIGHTSAIL_HOST`: 인스턴스 고정 IP 또는 도메인
- `LIGHTSAIL_USER`: `ubuntu`
- `LIGHTSAIL_SSH_KEY`: 배포 전용 SSH 개인키

서버가 비공개 리포를 pull하려면 GitHub Deploy Key(읽기 전용 SSH 키)를 리포 Settings → Deploy keys에 등록하고, 서버의 `origin` 리모트를 SSH 방식(`git@github.com:...`)으로 설정해야 한다.

### 운영 전환 시 DB 확장
실사용자가 늘어 SQLite 단일 파일로는 부족해지면 `src/db.js`만 PostgreSQL 드라이버로 교체하면 된다
(쿼리는 표준 SQL로 작성되어 있음). Lightsail의 관리형 데이터베이스(Managed Database, PostgreSQL)를
붙이는 방식으로 확장 가능.

## 폴더 구조
```
src/
  index.js           # 앱 진입점
  db.js              # DB 연결 + 마이그레이션 실행
  seed.js            # 초기 지역 데이터 시드
  migrations/
    001_init.sql      # regions, users 테이블
  middleware/
    authMiddleware.js # JWT 검증
  routes/
    auth.js
    users.js
    regions.js
```
