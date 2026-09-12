-- AGORA PostgreSQL 스키마. SQLite 마이그레이션 001~032를 합친 최종본(scripts/dump-schema 참고).

CREATE TABLE regions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'dispute'   -- dominant | contested | dispute
    CHECK (status IN ('dominant', 'contested', 'dispute')),
  lat           double precision,
  lng           double precision,
  created_at timestamp NOT NULL DEFAULT now()
, submission_until timestamp, occupied_until timestamp, thread_ban_until timestamp);

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  nickname            TEXT NOT NULL,
  region_id           TEXT NOT NULL REFERENCES regions(id),
  rank                TEXT NOT NULL DEFAULT 'citizen'
    CHECK (rank IN ('citizen', 'supporter', 'prophet')),
  region_changed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now(),
  reputation double precision NOT NULL DEFAULT 0,
  signup_ip           TEXT,
  belligerence double precision NOT NULL DEFAULT 0,
  downvotes_received double precision NOT NULL DEFAULT 0
, xp INTEGER NOT NULL DEFAULT 0, fool_score double precision NOT NULL DEFAULT 0);

CREATE TABLE threads (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL REFERENCES regions(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  body          TEXT,
  status        TEXT NOT NULL DEFAULT 'active'   -- active | collapsed | settled
    CHECK (status IN ('active', 'collapsed', 'settled')),
  created_at timestamp NOT NULL DEFAULT now()
, hidden INTEGER NOT NULL DEFAULT 0);

CREATE TABLE arguments (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  stance        TEXT NOT NULL CHECK (stance IN ('pro', 'con', 'other')),
  body          TEXT NOT NULL,
  upvotes double precision NOT NULL DEFAULT 0,
  downvotes double precision NOT NULL DEFAULT 0,
  hidden        INTEGER NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
, title TEXT NOT NULL DEFAULT '');

CREATE TABLE votes (
  id            TEXT PRIMARY KEY,
  argument_id   TEXT NOT NULL REFERENCES arguments(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamp NOT NULL DEFAULT now(), weight double precision NOT NULL DEFAULT 1.0, ip TEXT,
  UNIQUE (argument_id, voter_id)   -- 1계정 1논증 1표
);

CREATE TABLE judgment_votes (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  verdict       TEXT NOT NULL CHECK (verdict IN ('approve', 'collapse')),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (thread_id, voter_id)     -- 1계정 1논제 1표 (판정투표)
);

CREATE TABLE judgments (
  id               TEXT PRIMARY KEY,
  thread_id        TEXT NOT NULL REFERENCES threads(id),
  approve_votes double precision NOT NULL,
  collapse_votes double precision NOT NULL,
  participant_count INTEGER NOT NULL,
  verdict          TEXT NOT NULL CHECK (verdict IN ('collapse')),  -- 붕괴 확정된 건만 기록
  resolved_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE abuse_flags (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,          -- 'signup_ip_burst' | 'vote_burst' 등
  user_id     TEXT REFERENCES users(id),
  detail      TEXT NOT NULL,          -- 사람이 읽을 수 있는 설명
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE banned_words (
  id          TEXT PRIMARY KEY,
  word        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL DEFAULT 'general',  -- hate | spam | general 등
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE dominance_candidates (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id),
  region_id          TEXT NOT NULL REFERENCES regions(id),
  streak_days        INTEGER NOT NULL DEFAULT 0,
  last_counted_date date NOT NULL DEFAULT current_date, cooldown_until timestamp,
  UNIQUE (user_id, region_id)
);

CREATE TABLE dominance (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL UNIQUE REFERENCES regions(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  status        TEXT NOT NULL DEFAULT 'ruler' CHECK (status IN ('ruler', 'tyrant')),
  streak_days   INTEGER NOT NULL DEFAULT 7,
  started_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE follows (
  id            TEXT PRIMARY KEY,
  follower_id   TEXT NOT NULL REFERENCES users(id),
  followee_id   TEXT NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(), ip TEXT,
  UNIQUE (follower_id, followee_id)
);

CREATE TABLE religions (
  id            TEXT PRIMARY KEY,
  founder_id    TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE religion_tenets (
  id            TEXT PRIMARY KEY,
  religion_id   TEXT NOT NULL REFERENCES religions(id),
  thread_id     TEXT NOT NULL REFERENCES threads(id)
);

CREATE TABLE religion_members (
  id            TEXT PRIMARY KEY,
  religion_id   TEXT NOT NULL REFERENCES religions(id),
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  joined_at timestamp NOT NULL DEFAULT now()
, ip TEXT);

CREATE TABLE parties (
  id            TEXT PRIMARY KEY,
  founder_id    TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL UNIQUE,
  platform      TEXT NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE party_members (
  id            TEXT PRIMARY KEY,
  party_id      TEXT NOT NULL REFERENCES parties(id),
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  joined_at timestamp NOT NULL DEFAULT now()
, ip TEXT);

CREATE TABLE items (
  id                TEXT PRIMARY KEY,
  creator_id        TEXT REFERENCES users(id),
  owner_type        TEXT NOT NULL CHECK (owner_type IN ('religion', 'party', 'dominance', 'system', 'shop')),
  owner_id          TEXT,
  slot_type         TEXT NOT NULL CHECK (slot_type IN (
                      'accessory', 'badge', 'cloak', 'weapon',
                      'hat', 'face', 'top', 'pants', 'shoes', 'shield', 'jewelry', 'glasses', 'effect', 'background',
                      'title'
                    )),
  name              TEXT,
  price             INTEGER NOT NULL DEFAULT 0,
  design_asset_url  TEXT,
  payment_status    TEXT NOT NULL DEFAULT 'free' CHECK (payment_status IN ('pending', 'paid', 'free')),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE user_inventory (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  item_id       TEXT NOT NULL REFERENCES items(id),
  acquired_at timestamp NOT NULL DEFAULT now(), equipped INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, item_id)
);

CREATE TABLE payment_sessions (
  id            TEXT PRIMARY KEY,
  item_id       TEXT NOT NULL REFERENCES items(id),
  amount        INTEGER NOT NULL DEFAULT 15000,
  status        TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'confirmed', 'failed')),
  created_at timestamp NOT NULL DEFAULT now(),
  confirmed_at timestamp
);

CREATE TABLE wars (
  id                  TEXT PRIMARY KEY,
  attacker_region_id  TEXT NOT NULL REFERENCES regions(id),
  defender_region_id  TEXT NOT NULL REFERENCES regions(id),
  declared_by         TEXT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'voting'
    CHECK (status IN ('voting', 'accepted', 'avoided', 'void')),
  -- voting: 수락투표 진행중 / accepted: 개전(S12에서 실제 전투 처리) / avoided: 회피(부결) / void: 정족수 미달 무효
  vote_deadline       TEXT NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp
);

CREATE TABLE war_votes (
  id            TEXT PRIMARY KEY,
  war_id        TEXT NOT NULL REFERENCES wars(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  verdict       TEXT NOT NULL CHECK (verdict IN ('accept', 'reject')),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (war_id, voter_id)
);

CREATE TABLE war_battles (
  id                TEXT PRIMARY KEY,
  war_id            TEXT NOT NULL UNIQUE REFERENCES wars(id),
  title             TEXT NOT NULL,
  option_attacker   TEXT NOT NULL,
  option_defender   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  deadline          TEXT NOT NULL,
  winner_side       TEXT CHECK (winner_side IN ('attacker', 'defender')),
  created_at timestamp NOT NULL DEFAULT now(),
  settled_at timestamp
);

CREATE TABLE war_battle_choices (
  id            TEXT PRIMARY KEY,
  battle_id     TEXT NOT NULL REFERENCES war_battles(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  side          TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (battle_id, user_id)
);

CREATE TABLE war_battle_arguments (
  id            TEXT PRIMARY KEY,
  battle_id     TEXT NOT NULL REFERENCES war_battles(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  side          TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  body          TEXT NOT NULL,
  upvotes double precision NOT NULL DEFAULT 0,
  downvotes double precision NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE war_battle_votes (
  id            TEXT PRIMARY KEY,
  argument_id   TEXT NOT NULL REFERENCES war_battle_arguments(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (argument_id, voter_id)
);

CREATE TABLE dominance_history (
  id            TEXT PRIMARY KEY,
  region_id     TEXT NOT NULL REFERENCES regions(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  streak_days   INTEGER NOT NULL,
  started_at timestamp NOT NULL DEFAULT now(),
  ended_at timestamp,
  ended_reason  TEXT CHECK (ended_reason IN ('executed', 'conquered'))
);

CREATE TABLE influence (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  region_id     TEXT NOT NULL REFERENCES regions(id),
  points double precision NOT NULL DEFAULT 0,
  UNIQUE (user_id, region_id)
);

CREATE TABLE cultural_influence_zones (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  foreign_region_id TEXT NOT NULL REFERENCES regions(id),
  achieved_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (user_id, foreign_region_id)
);

CREATE TABLE culture_victories (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id),
  home_region_id TEXT NOT NULL REFERENCES regions(id),
  achieved_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE congress_approvals (
  id                  TEXT PRIMARY KEY,
  attacker_region_id  TEXT NOT NULL REFERENCES regions(id),
  defender_region_id  TEXT NOT NULL REFERENCES regions(id),
  declared_by         TEXT NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'voting'
    CHECK (status IN ('voting', 'approved', 'rejected')),
  -- voting: 승인투표 진행중 / approved: 승인 → 실제 전쟁 선포됨 / rejected: 부결(페널티 없음, 선포만 무산)
  war_id              TEXT REFERENCES wars(id), -- 승인되면 실제로 생성된 전쟁 id를 채운다
  vote_deadline       TEXT NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp
);

CREATE TABLE congress_votes (
  id            TEXT PRIMARY KEY,
  approval_id   TEXT NOT NULL REFERENCES congress_approvals(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  verdict       TEXT NOT NULL CHECK (verdict IN ('accept', 'reject')),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (approval_id, voter_id)
);

CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  sender_id     TEXT NOT NULL REFERENCES users(id),
  receiver_id   TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0,
  read_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE thread_votes (
  id            TEXT PRIMARY KEY,
  thread_id     TEXT NOT NULL REFERENCES threads(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  weight        double precision NOT NULL DEFAULT 1.0,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (thread_id, voter_id)
);

CREATE TABLE argument_replies (
  id            TEXT PRIMARY KEY,
  argument_id   TEXT NOT NULL REFERENCES arguments(id),
  author_id     TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE reply_votes (
  id            TEXT PRIMARY KEY,
  reply_id      TEXT NOT NULL REFERENCES argument_replies(id),
  voter_id      TEXT NOT NULL REFERENCES users(id),
  vote_type     TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  weight        double precision NOT NULL DEFAULT 1.0,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (reply_id, voter_id)
);

CREATE TABLE laugh_reactions (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument', 'reply')),
  target_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id),
  weight        double precision NOT NULL DEFAULT 1.0,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, user_id)
);

CREATE TABLE chat_messages (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  hidden        INTEGER NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id            TEXT PRIMARY KEY,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  target_type   TEXT NOT NULL CHECK (target_type IN ('thread', 'argument', 'user', 'message', 'chat_message')),
  target_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewer_note TEXT,
  created_at timestamp NOT NULL DEFAULT now(),
  reviewed_at timestamp
);

CREATE TABLE provinces (
  id          TEXT PRIMARY KEY,
  region_id   TEXT NOT NULL REFERENCES regions(id),
  name        TEXT NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  is_capital  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (region_id, name)
);

CREATE TABLE neighborhoods (
  id                TEXT PRIMARY KEY,
  parent_region_id  TEXT NOT NULL REFERENCES regions(id),
  name              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'npc' CHECK (status IN ('npc', 'contested', 'dominant')),
  npc_difficulty    INTEGER NOT NULL DEFAULT 30,
  dominant_user_id  TEXT REFERENCES users(id),
  -- 실제 GIS 좌표가 아니라 지도에 점을 찍기 위한 장식용 좌표(부모 지역 좌표 근처에 임의로 흩뿌림).
  lat               double precision,
  lng               double precision,
  created_at timestamp NOT NULL DEFAULT now(), province_id TEXT REFERENCES provinces(id),
  UNIQUE (parent_region_id, name)
);

CREATE TABLE neighborhood_adjacency (
  neighborhood_id           TEXT NOT NULL REFERENCES neighborhoods(id),
  adjacent_neighborhood_id  TEXT NOT NULL REFERENCES neighborhoods(id),
  PRIMARY KEY (neighborhood_id, adjacent_neighborhood_id)
);

CREATE TABLE neighborhood_contributions (
  id              TEXT PRIMARY KEY,
  neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  points double precision NOT NULL,
  ip              TEXT,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE neighborhood_resistance (
  id              TEXT PRIMARY KEY,
  neighborhood_id TEXT NOT NULL REFERENCES neighborhoods(id),
  user_id         TEXT NOT NULL REFERENCES users(id),
  points double precision NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE neighborhood_seasons (
  id          TEXT PRIMARY KEY,
  started_at timestamp NOT NULL DEFAULT now(),
  ended_at timestamp
);

CREATE TABLE neighborhood_season_champions (
  id               TEXT PRIMARY KEY,
  season_id        TEXT NOT NULL REFERENCES neighborhood_seasons(id),
  neighborhood_id  TEXT NOT NULL REFERENCES neighborhoods(id),
  user_id          TEXT NOT NULL REFERENCES users(id),
  final_points double precision NOT NULL,
  recorded_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE neighborhood_attacks (
  id                      TEXT PRIMARY KEY,
  target_neighborhood_id  TEXT NOT NULL REFERENCES neighborhoods(id),
  from_neighborhood_id    TEXT REFERENCES neighborhoods(id),
  attacker_id             TEXT NOT NULL REFERENCES users(id),
  attacker_power double precision NOT NULL,
  defense_power double precision NOT NULL,
  won                     INTEGER NOT NULL,
  insurrection            INTEGER NOT NULL DEFAULT 0,
  ip                      TEXT,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE neighborhood_founders (
  neighborhood_id  TEXT PRIMARY KEY REFERENCES neighborhoods(id),
  user_id          TEXT NOT NULL REFERENCES users(id),
  liberated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE map_posts (
  id           TEXT PRIMARY KEY,
  author_id    TEXT NOT NULL REFERENCES users(id),
  lat          double precision NOT NULL,
  lng          double precision NOT NULL,
  body         TEXT NOT NULL,
  upvotes double precision NOT NULL DEFAULT 0,
  downvotes double precision NOT NULL DEFAULT 0,
  fool_votes double precision NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
, province_id TEXT REFERENCES provinces(id));

CREATE TABLE map_post_votes (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES map_posts(id),
  voter_id    TEXT NOT NULL REFERENCES users(id),
  vote_type   TEXT NOT NULL CHECK (vote_type IN ('up', 'down', 'fool')),
  weight      double precision NOT NULL DEFAULT 1.0,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (post_id, voter_id)
);

CREATE TABLE user_tickers (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  ticker        TEXT NOT NULL,
  source_type   TEXT CHECK (source_type IN ('thread', 'argument', 'user')),
  source_id     TEXT,
  granted_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker, source_type, source_id)
);

CREATE TABLE map_post_comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES map_posts(id),
  author_id   TEXT NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threads_region ON threads(region_id);
CREATE INDEX IF NOT EXISTS idx_threads_author_created ON threads(author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_argument ON votes(argument_id);
CREATE INDEX IF NOT EXISTS idx_jvotes_thread ON judgment_votes(thread_id);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_created ON abuse_flags(created_at);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_votes_ip ON votes(ip);
CREATE INDEX IF NOT EXISTS idx_follows_ip ON follows(ip);
CREATE INDEX IF NOT EXISTS idx_wars_attacker ON wars(attacker_region_id);
CREATE INDEX IF NOT EXISTS idx_wars_defender ON wars(defender_region_id);
CREATE INDEX IF NOT EXISTS idx_war_votes_war ON war_votes(war_id);
CREATE INDEX IF NOT EXISTS idx_war_battle_args_battle ON war_battle_arguments(battle_id);
CREATE INDEX IF NOT EXISTS idx_dominance_history_region ON dominance_history(region_id);
CREATE INDEX IF NOT EXISTS idx_congress_approvals_attacker ON congress_approvals(attacker_region_id);
CREATE INDEX IF NOT EXISTS idx_congress_votes_approval ON congress_votes(approval_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_thread_votes_thread ON thread_votes(thread_id);
CREATE INDEX IF NOT EXISTS idx_arguments_thread ON arguments(thread_id);
CREATE INDEX IF NOT EXISTS idx_argument_replies_argument ON argument_replies(argument_id);
CREATE INDEX IF NOT EXISTS idx_reply_votes_reply ON reply_votes(reply_id);
CREATE INDEX IF NOT EXISTS idx_laugh_reactions_target ON laugh_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_region ON neighborhoods(parent_region_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_contrib_neighborhood ON neighborhood_contributions(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_contrib_user ON neighborhood_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_resist_lookup ON neighborhood_resistance(neighborhood_id, user_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_attacks_attacker ON neighborhood_attacks(attacker_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_attacks_target ON neighborhood_attacks(target_neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_map_posts_created ON map_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_map_post_comments_post ON map_post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_provinces_region ON provinces(region_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_province ON neighborhoods(province_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_latlng ON neighborhoods(lat, lng);
CREATE INDEX IF NOT EXISTS idx_map_posts_province ON map_posts(province_id);
CREATE INDEX IF NOT EXISTS idx_neighborhood_contrib_created ON neighborhood_contributions(created_at);
CREATE INDEX IF NOT EXISTS idx_neighborhood_attacks_created ON neighborhood_attacks(created_at);
CREATE INDEX IF NOT EXISTS idx_map_post_comments_created ON map_post_comments(created_at);
