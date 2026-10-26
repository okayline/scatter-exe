-- SCATTER.EXE database (Cloudflare D1: the moba-beat database; every table is named scatter_...)
--   npx wrangler d1 execute moba-beat --remote --file=schema.sql

-- A player is a browser cookie. The cookie holds a random token; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS scatter_players (
  id          INTEGER PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,       -- unix seconds
  seen_at     INTEGER NOT NULL
);

-- New players, counted per hashed IP and hour.
CREATE TABLE IF NOT EXISTS scatter_rate_limits (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

-- Sheets: one per player per UTC day. Made when the player presses START (the server keeps the time); the answers
-- are filled in once, when it is sealed on the ledger in the same D1 batch (src/ledger.js).
CREATE TABLE IF NOT EXISTS scatter_sheets (
  id          INTEGER PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES scatter_players(id),
  day         TEXT NOT NULL,          -- "2027-01-01" (UTC)
  started_at  INTEGER NOT NULL,       -- unix seconds
  answers     TEXT,                   -- JSON list of 8 answers ("" for a blank), once sealed
  sealed_at   INTEGER,
  UNIQUE (player_id, day)
);

-- One SHA-256 hash chain: one entry per UTC day (its letter and categories) and one per sealed sheet (src/ledger.js).
-- Records hold player ids, never names.
CREATE TABLE IF NOT EXISTS scatter_ledger (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL,          -- day | sheet
  day         TEXT NOT NULL,
  sheet_id    INTEGER,
  record      TEXT NOT NULL,          -- the sealed JSON record
  prev_hash   TEXT NOT NULL UNIQUE,   -- one entry per chain head: the chain can't fork
  hash        TEXT NOT NULL UNIQUE,   -- SHA-256(prev_hash + "|" + record)
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS scatter_ledger_one_sheet ON scatter_ledger (sheet_id) WHERE kind = 'sheet';
CREATE UNIQUE INDEX IF NOT EXISTS scatter_ledger_one_day ON scatter_ledger (day) WHERE kind = 'day';

-- Browsers loaded later with a save code or passkey (v0.2.0): each has its own cookie token here (hashed). The first
-- browser's token is scatter_players.token_hash. TriviaMoba uses this table too.
CREATE TABLE IF NOT EXISTS scatter_sessions (
  token_hash  TEXT PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES scatter_players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scatter_sessions_player ON scatter_sessions (player_id);
