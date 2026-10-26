-- v0.2.0: save codes and passkeys (src/accounts.js).
--   npx wrangler d1 execute moba-beat --remote --file=migrations/002_sessions.sql
-- Browsers loaded later with a save code or passkey (v0.2.0): each has its own cookie token here (hashed). The first
-- browser's token is scatter_players.token_hash. TriviaMoba uses this table too.
CREATE TABLE IF NOT EXISTS scatter_sessions (
  token_hash  TEXT PRIMARY KEY,
  player_id   INTEGER NOT NULL REFERENCES scatter_players(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  seen_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scatter_sessions_player ON scatter_sessions (player_id);
