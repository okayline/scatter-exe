# scatter-exe: working notes

## This repo

SCATTER.EXE: a daily Scattergories-style game. One letter and 8 categories a UTC day, the same for everyone, 2:00 to write one answer per category. Design doc: the Claude Doc "SCATTER.EXE: design idea" (https://claude.ai/artifact/5ciLoQfVvzGnNexwwZQ1rx). Treat a push to `main` as a release: the Worker may be connected to this repo.

- **The rules live in one file**, `public/engine/scatter.js` (letters, categories, the day's pick, what an answer must look like), loaded by the Worker, the page and the tests. Change a rule there, once.
- **The ledger is a hash chain** (`src/ledger.js`): a `day` entry (its record is the day's letter and categories, picked from the hash before it) and one `sheet` entry per player per day, written in the same D1 batch as the sheet. Records hold player ids, never names. Don't weaken `prev_hash UNIQUE`.
- **Sheets stay secret until the day closes.** The letter and categories are only sent to a player once they press START, and the server keeps the start time.
- The frame, font and colours are copied from TILT.EXE (`clutch-feed-tilt/public/index.html`, itself from 4Dungeon). `public/fonts/VT323-Regular.ttf` is OFL (see `public/fonts/OFL.txt`).
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live `moba-beat` database migrated before the push that needs it. SCATTER.EXE's tables live there (shared with moba-beat and Daily Pitch), every one named `scatter_...`.
- **Testing:** `npm test` must pass before any commit, plus one quick check of whatever changed. Expected values come from hand-worked examples or node:crypto, not the code under test.
- **Releases:** every release bumps `VERSION` in `public/engine/version.js` and adds a `CHANGELOG.md` entry (a test checks they match). The detailed dev entries are in dungeon-notes `scatter-exe/changelog-v0.1.md`. No browser popups (confirm/alert/prompt).
