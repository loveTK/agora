# AGORA — S1~S5 스프린트 (베타 오픈 가능 시점)

스프린트표 기준 **S1~S5** 구현체입니다. 여기까지가 원래 로드맵상 "베타 오픈 가능 시점"입니다.

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

## 기술 스택
- Node.js + Express
- SQLite (better-sqlite3) — 베타 단계용. 운영 전환 시 `src/db.js`만 PostgreSQL 드라이버로 교체하면 됩니다(쿼리는 표준 SQL).
- JWT 인증 (jsonwebtoken) + bcrypt 비밀번호 해싱

## 실행 방법
```bash
npm install
cp .env.example .env
npm run seed     # 초기 지역 6곳(서울/도쿄/뉴욕/런던/베를린/상하이) 시드
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

인증이 필요한 요청은 헤더에 `Authorization: Bearer <token>`을 포함하세요.
관리자 전용(`/internal/*`) 요청은 헤더에 `x-admin-token: <ADMIN_TOKEN>`을 포함하세요. 기본값은 `.env`의 `ADMIN_TOKEN`이며, 운영 배포 전 반드시 강력한 값으로 교체하세요.

## 실시간 이벤트 (Socket.io)
클라이언트는 `http://localhost:4000`에 Socket.io로 접속 후 `region:update` 이벤트를 구독하면 됩니다.
```js
const socket = io("http://localhost:4000");
socket.on("region:update", ({ region_id, status }) => {
  // 지도 마커 색상 갱신
});
```

## 다음 스프린트(S6)에서 이어 붙일 것
- 계급 시스템: 시민→추종자→선지자 자동 승급 로직 (reputation 누적 → rank 갱신)
- DOMINANCE 테이블: 7일 연속 무패 판정 → 지배자 등극, 처형 연출 트리거
- 지역 상태에 `dominant` 반영 (지금은 `regionStatus.js`가 의도적으로 건드리지 않음)

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
- 프론트엔드(`agora.html`)는 별도 리포/Netlify에 있다면 그대로 유지하고 API 엔드포인트만
  Lightsail 도메인으로 교체, 또는 같은 인스턴스의 Nginx에서 정적 파일로 함께 서빙 가능

### 최초 배포
1. Lightsail 콘솔에서 Ubuntu 22.04 인스턴스 생성, 고정 IP(Static IP) 연결
2. 방화벽(Networking 탭)에서 80, 443만 공개, 4000은 막아둔다 (Nginx를 통해서만 접근)
3. SSH 접속 후:
   ```bash
   git clone https://github.com/lovetk/agora.git ~/agora
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
- `LIGHTSAIL_SSH_KEY`: 배포 전용 SSH 개인키 (Lightsail 콘솔에서 발급받은 키 또는 별도 등록한 공개키의 짝)

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
