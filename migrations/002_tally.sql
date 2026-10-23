-- SCATTER.EXE: the end-of-day tally (run on the moba-beat database before the push that needs it):
--   npx wrangler d1 execute moba-beat --remote --file=migrations/002_tally.sql
-- For each finished day, how many sealed sheets gave each answer in each category (by sameKey, public/engine/scatter.js).
-- Written once, by the first request for the day's results after the last possible sheet has arrived, and never changed.
CREATE TABLE IF NOT EXISTS scatter_tally (
  day      TEXT PRIMARY KEY,          -- "2027-01-01" (UTC)
  players  INTEGER NOT NULL,          -- sealed sheets that day
  counts   TEXT NOT NULL,             -- JSON: one { sameKey: how many } per category
  made_at  INTEGER NOT NULL           -- unix seconds
);
