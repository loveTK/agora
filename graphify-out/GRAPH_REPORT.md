# Graph Report - agora  (2026-09-11)

## Corpus Check
- 117 files · ~73,857 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 680 nodes · 1083 edges · 55 communities (40 shown, 13 thin omitted)
- Extraction: 83% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 175 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Homepage Map & UI
- Replies/XP Backend
- Mobile App Frontend
- Threads Route Backend
- Users Route Backend
- Express App Bootstrap
- Party/Religion Backend
- Docs: Sprint Feature Log
- NPM Dependencies
- V3 Neighborhood Conquest
- Wars/Battles Backend
- Auth Backend
- Mobile App Config
- Congress Approval Backend
- Activity/Follower Conquest
- Map-Post Pins Backend
- Internal Admin Batch Jobs
- DB Seeding
- DB Core & Military Power
- Judgment/Execution Settlement
- Google Auth & Admin UI
- Auth Middleware & Items
- Messages & Content Filter
- War/Congress Frontend UI
- Hall of Fame & Hot Agenda
- Chat Backend
- Regions Route Backend
- Reports Moderation Backend
- Real-time Chat Frontend
- Admin Auth Middleware
- Neighborhood Seeding
- Mobile TS Config
- Dominance Settlement
- Direct Messaging Frontend
- Lightsail Deploy Pipeline
- Mobile App Docs
- Tyrant Status Logic
- Faction System Frontend
- Admin/Moderation Docs
- Abuse Detection Docs
- Hall of Fame Route
- Setup Script
- SEO Verification Files
- Reaction System Docs
- Android Icon Background
- Android Icon Foreground
- Android Monochrome Icon
- Mobile Favicon
- Mobile App Icon
- Mobile Splash Icon
- OG Preview Image
- Argument Stance Option
- Region-Move Reset Policy

## God Nodes (most connected - your core abstractions)
1. `db` - 51 edges
2. `express` - 23 edges
3. `requireAuth()` - 16 edges
4. `grantXp()` - 11 edges
5. `expo` - 10 edges
6. `belligerenceTier()` - 9 edges
7. `levelProgress()` - 9 edges
8. `getVoteWeight()` - 9 edges
9. `initMap()` - 9 edges
10. `toggleLaugh()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Contribution / Attack / Insurrection Mechanic` --semantically_similar_to--> `S11: War Declaration & Acceptance Vote`  [INFERRED] [semantically similar]
  v3.html → README.md
- `Tenet Selection From Own Threads (3-5, via GET /threads/mine)` --semantically_similar_to--> `Party Creation Gate: Follower Count ≥100 or Current Ruler`  [INFERRED] [semantically similar]
  religion-create.html → party-create.html
- `Lightsail Deploy CD Job` --conceptually_related_to--> `SQLite→PostgreSQL Migration Path`  [AMBIGUOUS]
  .github/workflows/deploy-lightsail.yml → README.md
- `Thread Archive Placeholder Page` --conceptually_related_to--> `S2: Threads & Arguments`  [INFERRED]
  archive.html → README.md
- `V3 Neighborhood-Level Conquest MVP` --conceptually_related_to--> `S6: Rank Promotion & Dominance (7-day win streak)`  [AMBIGUOUS]
  v3.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Thread → Argument → Reaction/Reply Debate Flow** — agora_openthreadmodal, agora_attachreactionhandlers, agora_renderreplylist, agora_route_threads, agora_route_arguments [INFERRED 0.85]
- **Region Detail → Dominance Check → Conquer Action** — agora_openregionmodal, agora_renderregionpage, agora_route_regions, agora_conquest_system [INFERRED 0.85]
- **Socket.io-driven Live Map/Chat Updates** — agora_initmap, agora_initchat, agora_realtime_socket, agora_chat_system, agora_map_system [INFERRED 0.85]
- **Faction Creation Flow (Religion & Party)** — party_create_form, religion_create_form, readme_follow_religion_party [EXTRACTED 1.00]
- **Territory Conquest Mechanics (Region War vs Neighborhood Conquest)** — v3_neighborhood_conquest, readme_war_declaration_system, readme_battle_conquest_system [INFERRED 0.75]
- **Production Deployment Pipeline** — github_workflows_deploy_lightsail_deploy_job, readme_lightsail_deployment, readme_sqlite_postgres_migration_path [EXTRACTED 1.00]

## Communities (55 total, 13 thin omitted)

### Community 0 - "Homepage Map & UI"
Cohesion: 0.06
Nodes (46): addMapPostMarker(), apiRequest(), attachReactionHandlers(), centerMapOnUser(), Region Dominance / Conquest System, handleXpGain(), initMap(), initMapPosts() (+38 more)

### Community 1 - "Replies/XP Backend"
Cohesion: 0.07
Nodes (37): express, { requireAuth }, router, { toggleLaugh }, { toggleReplyVote }, { db }, grantTitleForLevel(), grantXp() (+29 more)

### Community 2 - "Mobile App Frontend"
Cohesion: 0.05
Nodes (38): apiRequest(), App(), handleSubmit(), HotIssue, RANK_LABEL, Region, storage, styles (+30 more)

### Community 3 - "Threads Route Backend"
Cohesion: 0.06
Nodes (36): { checkAndGrantSphinxTicker }, { containsBannedWord }, { db }, express, { getTally, settleThread, QUORUM, COLLAPSE_THRESHOLD }, { grantWeaponIfEligible }, { grantXp, XP_THREAD_CREATE, XP_ARGUMENT_CREATE }, { randomUUID } (+28 more)

### Community 4 - "Users Route Backend"
Cohesion: 0.06
Nodes (35): { belligerenceTier }, { checkFollowBrigading }, { db }, express, followerCount(), { getUserProfileSummary }, { INFLUENCE_THRESHOLD }, { levelProgress } (+27 more)

### Community 5 - "Express App Bootstrap"
Cohesion: 0.06
Nodes (34): activityRoutes, adminRoutes, app, authRoutes, chatRoutes, congressRoutes, cors, express (+26 more)

### Community 6 - "Party/Religion Backend"
Cohesion: 0.08
Nodes (29): { checkJoinBrigading }, { db }, express, { grantExistingPaidItemsOnJoin }, joinParty(), { PARTY_CREATE_FOLLOWER_THRESHOLD }, { randomUUID }, { requireAuth } (+21 more)

### Community 7 - "Docs: Sprint Feature Log"
Cohesion: 0.10
Nodes (28): AGORA Korean About Page, Thread Archive Placeholder Page, AGORA English About Page, party-create.html POST /parties Call, Party Creation Gate: Follower Count ≥100 or Current Ruler, Party Creation Form (party-create.html), Public/Internal REST API Endpoint List, S12: Faction Battle & Territory Occupation (+20 more)

### Community 8 - "NPM Dependencies"
Cohesion: 0.07
Nodes (27): author, dependencies, bcryptjs, better-sqlite3, cors, dotenv, express, google-auth-library (+19 more)

### Community 9 - "V3 Neighborhood Conquest"
Cohesion: 0.13
Nodes (23): { db }, express, { getSeasonProgress }, {
  getTotalPoints,
  getTopContributors,
  getResistancePoints,
  recordContribution,
  attemptAttack,
  RESISTANCE_THRESHOLD,
}, { requireAuth, optionalAuth }, router, attemptAttack(), checkLiberation() (+15 more)

### Community 10 - "Wars/Battles Backend"
Cohesion: 0.13
Nodes (19): { createBattle, getBattleTally, isWarParticipant, resolveBattle }, { db }, express, { getWarTally, resolveWarIfReady, VOTE_QUORUM, APPROVAL_RATIO }, { grantXp, XP_WAR_PARTICIPATION }, { randomUUID }, { requestWarDeclaration }, { requireAuth } (+11 more)

### Community 11 - "Auth Backend"
Cohesion: 0.12
Nodes (17): bcrypt, { belligerenceTier }, { db }, express, jwt, { JWT_SECRET }, { levelProgress }, { OAuth2Client } (+9 more)

### Community 12 - "Mobile App Config"
Cohesion: 0.11
Nodes (18): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+10 more)

### Community 13 - "Congress Approval Backend"
Cohesion: 0.18
Nodes (16): { db }, express, {
  getApprovalTally,
  resolveApprovalIfReady,
  CONGRESS_POWER_THRESHOLD,
  APPROVAL_RATIO,
}, { randomUUID }, { requireAuth }, router, { db }, { declareWar } (+8 more)

### Community 14 - "Activity/Follower Conquest"
Cohesion: 0.16
Nodes (13): { db }, express, { getUserProfileSummary }, router, attemptFollowerConquest(), { db }, { followerCount }, { randomUUID } (+5 more)

### Community 15 - "Map-Post Pins Backend"
Cohesion: 0.13
Nodes (13): { checkAndGrantFoolTicker }, { containsBannedWord }, { db }, express, { getVoteWeight }, { randomUUID }, { refreshTyrantStatus }, { requireAuth, optionalAuth } (+5 more)

### Community 16 - "Internal Admin Batch Jobs"
Cohesion: 0.15
Nodes (12): { db }, { distributeItem }, express, { refreshTyrantStatus }, router, { seedNeighborhoodsIfEmpty }, { settleAllActiveThreads }, { settleDominance } (+4 more)

### Community 17 - "DB Seeding"
Cohesion: 0.20
Nodes (11): bcryptjs, runMigrations(), BANNED_WORDS, bcrypt, { db, runMigrations }, OFFICIAL_QUESTIONS, { randomUUID, randomBytes }, REGIONS (+3 more)

### Community 18 - "DB Core & Military Power"
Cohesion: 0.20
Nodes (9): Database, fs, path, { db }, regionMilitaryPower(), { db }, { randomUUID }, { regionMilitaryPower } (+1 more)

### Community 19 - "Judgment/Execution Settlement"
Cohesion: 0.24
Nodes (10): db, { db }, executeIfRuler(), { randomUUID }, { db }, { executeIfRuler }, getTally(), { randomUUID } (+2 more)

### Community 20 - "Google Auth & Admin UI"
Cohesion: 0.22
Nodes (9): Admin Report Moderation Panel, Auth (Google Sign-In + Session) System, Google Identity Services (external), handleGoogleCredential(), initGoogleSignIn(), renderAdminView(), Backend route: /auth/*, /admin/login, Backend route: /internal/reports (admin) (+1 more)

### Community 21 - "Auth Middleware & Items"
Cohesion: 0.20
Nodes (9): jsonwebtoken, jwt, optionalAuth(), requireAuth(), { db }, express, { randomUUID }, { requireAuth } (+1 more)

### Community 22 - "Messages & Content Filter"
Cohesion: 0.22
Nodes (8): { containsBannedWord }, { db }, express, { randomUUID }, { requireAuth }, router, containsBannedWord(), { db }

### Community 23 - "War/Congress Frontend UI"
Cohesion: 0.47
Nodes (9): attachCongressActionHandlers(), attachWarActionHandlers(), Congress Approval Vote System, renderCongressApprovalItem(), renderWarItem(), renderWars(), Backend route: /congress-approvals/*, Backend route: /wars/* (+1 more)

### Community 24 - "Hall of Fame & Hot Agenda"
Cohesion: 0.22
Nodes (7): express, { db }, express, router, { db }, express, router

### Community 25 - "Chat Backend"
Cohesion: 0.22
Nodes (7): { containsBannedWord }, { db }, express, lastSentAt, { randomUUID }, { requireAuth }, router

### Community 26 - "Regions Route Backend"
Cohesion: 0.25
Nodes (7): { attemptFollowerConquest }, { db }, express, { randomUUID }, { regionMilitaryPower }, { requireAuth }, router

### Community 27 - "Reports Moderation Backend"
Cohesion: 0.25
Nodes (5): { db }, express, { randomUUID }, { requireAuth }, router

### Community 28 - "Real-time Chat Frontend"
Cohesion: 0.38
Nodes (7): appendChatMessage(), Real-time Public Chat, initChat(), Socket.io Real-time Update Layer, renderChatInputArea(), Backend route: /chat/*, Socket.io Client Library (external)

### Community 29 - "Admin Auth Middleware"
Cohesion: 0.33
Nodes (4): requireAdmin(), { ADMIN_TOKEN, ADMIN_ID, ADMIN_PASSWORD }, express, router

### Community 30 - "Neighborhood Seeding"
Cohesion: 0.40
Nodes (5): CITY_NEIGHBORHOODS, { db }, jitter(), { randomUUID }, seedNeighborhoodsIfEmpty()

### Community 31 - "Mobile TS Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 32 - "Dominance Settlement"
Cohesion: 0.40
Nodes (4): { db }, { QUORUM }, { randomUUID }, settleDominance()

### Community 33 - "Direct Messaging Frontend"
Cohesion: 0.83
Nodes (4): Direct Messaging (쪽지함) System, openConversation(), renderMessages(), Backend route: /messages/*

### Community 34 - "Lightsail Deploy Pipeline"
Cohesion: 0.67
Nodes (4): Lightsail Deploy CD Job, AWS Lightsail Deployment (Nginx+PM2+Certbot), SQLite→PostgreSQL Migration Path, Tech Stack (Node/Express/SQLite/JWT)

### Community 35 - "Mobile App Docs"
Cohesion: 0.50
Nodes (4): Expo Versioned-Docs Notice (AGENTS.md), CLAUDE.md → AGENTS.md Delegation, S1: Auth & Region Assignment, S14: Mobile App (Expo/React Native)

### Community 36 - "Tyrant Status Logic"
Cohesion: 0.67
Nodes (3): countActionedReportsAgainst(), { db }, refreshTyrantStatus()

### Community 37 - "Faction System Frontend"
Cohesion: 0.67
Nodes (3): Religion / Party Faction System, renderFactions(), Backend route: /religions, /parties, /{kind}/:id/join

### Community 38 - "Admin/Moderation Docs"
Cohesion: 0.67
Nodes (3): Admin Page Login (/admin/login), S5: Content Filter & Reports/Admin Moderation, Direct Messages (DM)

### Community 39 - "Abuse Detection Docs"
Cohesion: 0.67
Nodes (3): S10: Coordinated Multi-Account Brigading Detection, S4: Realtime Region Sync & Abuse Detection v1, S3: Voting & Judgment (Collapse)

## Ambiguous Edges - Review These
- `reactionButtonsHtml()` → `openUserProfileModal()`  [AMBIGUOUS]
  agora.html · relation: calls
- `Lightsail Deploy CD Job` → `SQLite→PostgreSQL Migration Path`  [AMBIGUOUS]
  .github/workflows/deploy-lightsail.yml · relation: conceptually_related_to
- `S6: Rank Promotion & Dominance (7-day win streak)` → `V3 Neighborhood-Level Conquest MVP`  [AMBIGUOUS]
  v3.html · relation: conceptually_related_to
- `Public/Internal REST API Endpoint List` → `v3.html /neighborhoods API Calls`  [AMBIGUOUS]
  v3.html · relation: conceptually_related_to

## Knowledge Gaps
- **383 isolated node(s):** `setup.sh script`, `storage`, `RANK_LABEL`, `Region`, `User` (+378 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 405 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `reactionButtonsHtml()` and `openUserProfileModal()`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **What is the exact relationship between `Lightsail Deploy CD Job` and `SQLite→PostgreSQL Migration Path`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `S6: Rank Promotion & Dominance (7-day win streak)` and `V3 Neighborhood-Level Conquest MVP`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Public/Internal REST API Endpoint List` and `v3.html /neighborhoods API Calls`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `db` connect `Judgment/Execution Settlement` to `Replies/XP Backend`, `Threads Route Backend`, `Users Route Backend`, `Party/Religion Backend`, `V3 Neighborhood Conquest`, `Wars/Battles Backend`, `Auth Backend`, `Congress Approval Backend`, `Activity/Follower Conquest`, `Map-Post Pins Backend`, `Internal Admin Batch Jobs`, `DB Seeding`, `DB Core & Military Power`, `Auth Middleware & Items`, `Messages & Content Filter`, `Hall of Fame & Hot Agenda`, `Chat Backend`, `Regions Route Backend`, `Reports Moderation Backend`, `Neighborhood Seeding`, `Dominance Settlement`, `Tyrant Status Logic`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `express` connect `Hall of Fame & Hot Agenda` to `Replies/XP Backend`, `Threads Route Backend`, `Users Route Backend`, `Express App Bootstrap`, `Party/Religion Backend`, `NPM Dependencies`, `V3 Neighborhood Conquest`, `Wars/Battles Backend`, `Auth Backend`, `Congress Approval Backend`, `Activity/Follower Conquest`, `Map-Post Pins Backend`, `Internal Admin Batch Jobs`, `Auth Middleware & Items`, `Messages & Content Filter`, `Chat Backend`, `Regions Route Backend`, `Reports Moderation Backend`, `Admin Auth Middleware`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `setup.sh script`, `storage`, `RANK_LABEL` to the rest of the system?**
  _383 weakly-connected nodes found - possible documentation gaps or missing edges._