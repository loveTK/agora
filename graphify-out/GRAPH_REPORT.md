# Graph Report - agora  (2026-09-11)

## Corpus Check
- 106 files · ~86,676 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 725 nodes · 1154 edges · 53 communities (38 shown, 13 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `024095fa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- initMap
- votes.js
- Mobile App Frontend
- threads.js
- seedProvinces.js
- index.js
- parties.js
- Docs: Sprint Feature Log
- NPM Dependencies
- neighborhoods.js
- wars.js
- users.js
- Mobile App Config
- reactionPath
- Backend route: /users/*
- mapPosts.js
- db.js
- DB Seeding
- openThreadModal
- Map Free-Post Pin System
- Google Auth & Admin UI
- Auth Middleware & Items
- Messages & Content Filter
- War/Congress Frontend UI
- Hall of Fame & Hot Agenda
- Chat Backend
- Q: Is V3 (neighborhood conquest) meant to replace the region-level war/dominance system, or run alongside it permanently?
- Reports Moderation Backend
- Real-time Chat Frontend
- Admin Auth Middleware
- openUserProfileModal
- Mobile TS Config
- Direct Messaging Frontend
- Lightsail Deploy Pipeline
- Mobile App Docs
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
1. `db` - 54 edges
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
- `Tenet Selection From Own Threads (3-5, via GET /threads/mine)` --semantically_similar_to--> `Party Creation Gate: Follower Count ≥100 or Current Ruler`  [INFERRED] [semantically similar]
  religion-create.html → party-create.html
- `Contribution / Attack / Insurrection Mechanic` --semantically_similar_to--> `S11: War Declaration & Acceptance Vote`  [INFERRED] [semantically similar]
  v3.html → README.md
- `Lightsail Deploy CD Job` --conceptually_related_to--> `SQLite→PostgreSQL Migration Path`  [AMBIGUOUS]
  .github/workflows/deploy-lightsail.yml → README.md
- `Thread Archive Placeholder Page` --conceptually_related_to--> `S2: Threads & Arguments`  [INFERRED]
  archive.html → README.md
- `v3.html /neighborhoods API Calls` --conceptually_related_to--> `Public/Internal REST API Endpoint List`  [AMBIGUOUS]
  v3.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Faction Creation Flow (Religion & Party)** — party_create_form, religion_create_form, readme_follow_religion_party [EXTRACTED 1.00]
- **Production Deployment Pipeline** — github_workflows_deploy_lightsail_deploy_job, readme_lightsail_deployment, readme_sqlite_postgres_migration_path [EXTRACTED 1.00]
- **Territory Conquest Mechanics (Region War vs Neighborhood Conquest)** — v3_neighborhood_conquest, readme_war_declaration_system, readme_battle_conquest_system [INFERRED 0.75]
- **Socket.io-driven Live Map/Chat Updates** — agora_initmap, agora_initchat, agora_realtime_socket, agora_chat_system, agora_map_system [INFERRED 0.85]
- **Region Detail → Dominance Check → Conquer Action** — agora_openregionmodal, agora_renderregionpage, agora_route_regions, agora_conquest_system [INFERRED 0.85]
- **Thread → Argument → Reaction/Reply Debate Flow** — agora_openthreadmodal, agora_attachreactionhandlers, agora_renderreplylist, agora_route_threads, agora_route_arguments [INFERRED 0.85]

## Communities (53 total, 13 thin omitted)

### Community 0 - "initMap"
Cohesion: 0.26
Nodes (10): centerMapOnUser(), Region Dominance / Conquest System, initMap(), Leaflet.js Map Library (external), Leaflet World Region Map, markerIcon(), openRegionModal(), renderRegionPage() (+2 more)

### Community 1 - "votes.js"
Cohesion: 0.05
Nodes (45): express, { requireAuth }, router, { toggleLaugh }, { toggleReplyVote }, { applyInfluenceDelta }, { checkVoteBrigading }, { containsBannedWord } (+37 more)

### Community 2 - "Mobile App Frontend"
Cohesion: 0.05
Nodes (38): apiRequest(), App(), handleSubmit(), HotIssue, RANK_LABEL, Region, storage, styles (+30 more)

### Community 3 - "threads.js"
Cohesion: 0.05
Nodes (42): { checkAndGrantSphinxTicker }, { containsBannedWord }, { db }, express, { getTally, settleThread, QUORUM, COLLAPSE_THRESHOLD }, { grantWeaponIfEligible }, { grantXp, XP_THREAD_CREATE, XP_ARGUMENT_CREATE }, { randomUUID } (+34 more)

### Community 4 - "seedProvinces.js"
Cohesion: 0.09
Nodes (29): clampLat(), COUNTRIES, { db }, { randomUUID }, seedCountriesIfMissing(), TERRITORIES, wrapLng(), backfillPostProvinces() (+21 more)

### Community 5 - "index.js"
Cohesion: 0.05
Nodes (36): activityRoutes, adminRoutes, app, authRoutes, chatRoutes, congressRoutes, cors, express (+28 more)

### Community 6 - "parties.js"
Cohesion: 0.09
Nodes (26): { checkJoinBrigading }, { db }, express, { grantExistingPaidItemsOnJoin }, joinParty(), { PARTY_CREATE_FOLLOWER_THRESHOLD }, { randomUUID }, { requireAuth } (+18 more)

### Community 7 - "Docs: Sprint Feature Log"
Cohesion: 0.10
Nodes (28): AGORA Korean About Page, Thread Archive Placeholder Page, AGORA English About Page, party-create.html POST /parties Call, Party Creation Gate: Follower Count ≥100 or Current Ruler, Party Creation Form (party-create.html), Public/Internal REST API Endpoint List, S12: Faction Battle & Territory Occupation (+20 more)

### Community 8 - "NPM Dependencies"
Cohesion: 0.07
Nodes (27): author, dependencies, bcryptjs, better-sqlite3, cors, dotenv, express, google-auth-library (+19 more)

### Community 9 - "neighborhoods.js"
Cohesion: 0.11
Nodes (26): baseProvinceRows(), clusterCache, countBy(), { db }, express, { getSeasonProgress }, {
  getTotalPoints,
  getTopContributors,
  getResistancePoints,
  recordContribution,
  attemptAttack,
  RESISTANCE_THRESHOLD,
}, { requireAuth, optionalAuth } (+18 more)

### Community 10 - "wars.js"
Cohesion: 0.05
Nodes (49): { db }, express, {
  getApprovalTally,
  resolveApprovalIfReady,
  CONGRESS_POWER_THRESHOLD,
  APPROVAL_RATIO,
}, { randomUUID }, { requireAuth }, router, { attemptFollowerConquest }, { db } (+41 more)

### Community 11 - "users.js"
Cohesion: 0.05
Nodes (50): { db }, express, { getUserProfileSummary }, router, bcrypt, { belligerenceTier }, { db }, express (+42 more)

### Community 12 - "Mobile App Config"
Cohesion: 0.11
Nodes (18): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+10 more)

### Community 13 - "reactionPath"
Cohesion: 0.33
Nodes (8): apiRequest(), attachReactionHandlers(), handleXpGain(), 추천/비추천/바보 Reaction System, reactionPath(), Backend route: /replies/*, updateXpBar(), XP / Level Progression System

### Community 14 - "Backend route: /users/*"
Cohesion: 0.25
Nodes (8): Shop / Inventory / Equipment System, renderInventoryView(), renderLoggedIn(), renderShop(), renderTopDebater(), Backend route: /activity/*, Backend route: /items/*, Backend route: /users/*

### Community 15 - "mapPosts.js"
Cohesion: 0.12
Nodes (15): { checkAndGrantFoolTicker }, { containsBannedWord }, { db }, express, { getVoteWeight }, { levelForXp }, { nearestProvinceId }, { randomUUID } (+7 more)

### Community 16 - "db.js"
Cohesion: 0.06
Nodes (40): Database, db, fs, path, { db }, { distributeItem }, express, { refreshTyrantStatus } (+32 more)

### Community 17 - "DB Seeding"
Cohesion: 0.20
Nodes (11): bcryptjs, runMigrations(), BANNED_WORDS, bcrypt, { db, runMigrations }, OFFICIAL_QUESTIONS, { randomUUID, randomBytes }, REGIONS (+3 more)

### Community 18 - "openThreadModal"
Cohesion: 0.31
Nodes (9): openThreadModal(), renderHotIssues(), renderReplyList(), renderThreadForm(), Backend route: /arguments/*, Backend route: /hot-agenda, Backend route: /threads/*, Thread / Argument Debate System (+1 more)

### Community 19 - "Map Free-Post Pin System"
Cohesion: 0.46
Nodes (7): addMapPostMarker(), initMapPosts(), loadMapPosts(), Map Free-Post Pin System, openMapPostWriteForm(), renderMapPostPopup(), Backend route: /map-posts/*

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

### Community 26 - "Q: Is V3 (neighborhood conquest) meant to replace the region-level war/dominance system, or run alongside it permanently?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Is V3 (neighborhood conquest) meant to replace the region-level war/dominance system, or run alongside it permanently?, Source Nodes

### Community 27 - "Reports Moderation Backend"
Cohesion: 0.25
Nodes (5): { db }, express, { randomUUID }, { requireAuth }, router

### Community 28 - "Real-time Chat Frontend"
Cohesion: 0.38
Nodes (7): appendChatMessage(), Real-time Public Chat, initChat(), Socket.io Real-time Update Layer, renderChatInputArea(), Backend route: /chat/*, Socket.io Client Library (external)

### Community 29 - "Admin Auth Middleware"
Cohesion: 0.33
Nodes (4): requireAdmin(), { ADMIN_TOKEN, ADMIN_ID, ADMIN_PASSWORD }, express, router

### Community 30 - "openUserProfileModal"
Cohesion: 0.50
Nodes (4): openUserProfileModal(), User Profile Modal / Character Card, reactionButtonsHtml(), renderCharCard()

### Community 31 - "Mobile TS Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 33 - "Direct Messaging Frontend"
Cohesion: 0.83
Nodes (4): Direct Messaging (쪽지함) System, openConversation(), renderMessages(), Backend route: /messages/*

### Community 34 - "Lightsail Deploy Pipeline"
Cohesion: 0.67
Nodes (4): Lightsail Deploy CD Job, AWS Lightsail Deployment (Nginx+PM2+Certbot), SQLite→PostgreSQL Migration Path, Tech Stack (Node/Express/SQLite/JWT)

### Community 35 - "Mobile App Docs"
Cohesion: 0.50
Nodes (4): Expo Versioned-Docs Notice (AGENTS.md), CLAUDE.md → AGENTS.md Delegation, S1: Auth & Region Assignment, S14: Mobile App (Expo/React Native)

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
- `openUserProfileModal()` → `reactionButtonsHtml()`  [AMBIGUOUS]
  agora.html · relation: calls
- `Lightsail Deploy CD Job` → `SQLite→PostgreSQL Migration Path`  [AMBIGUOUS]
  .github/workflows/deploy-lightsail.yml · relation: conceptually_related_to
- `v3.html /neighborhoods API Calls` → `Public/Internal REST API Endpoint List`  [AMBIGUOUS]
  v3.html · relation: conceptually_related_to
- `V3 Neighborhood-Level Conquest MVP` → `S6: Rank Promotion & Dominance (7-day win streak)`  [AMBIGUOUS]
  v3.html · relation: conceptually_related_to

## Knowledge Gaps
- **407 isolated node(s):** `setup.sh script`, `storage`, `RANK_LABEL`, `Region`, `User` (+402 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 431 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `openUserProfileModal()` and `reactionButtonsHtml()`?**
  _Edge tagged AMBIGUOUS (relation: calls) - confidence is low._
- **What is the exact relationship between `Lightsail Deploy CD Job` and `SQLite→PostgreSQL Migration Path`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `v3.html /neighborhoods API Calls` and `Public/Internal REST API Endpoint List`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `V3 Neighborhood-Level Conquest MVP` and `S6: Rank Promotion & Dominance (7-day win streak)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `db` connect `db.js` to `votes.js`, `threads.js`, `seedProvinces.js`, `parties.js`, `neighborhoods.js`, `wars.js`, `users.js`, `mapPosts.js`, `DB Seeding`, `Auth Middleware & Items`, `Messages & Content Filter`, `Hall of Fame & Hot Agenda`, `Chat Backend`, `Reports Moderation Backend`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `express` connect `Hall of Fame & Hot Agenda` to `votes.js`, `threads.js`, `index.js`, `parties.js`, `NPM Dependencies`, `neighborhoods.js`, `wars.js`, `users.js`, `mapPosts.js`, `db.js`, `Auth Middleware & Items`, `Messages & Content Filter`, `Chat Backend`, `Reports Moderation Backend`, `Admin Auth Middleware`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `setup.sh script`, `storage`, `RANK_LABEL` to the rest of the system?**
  _407 weakly-connected nodes found - possible documentation gaps or missing edges._