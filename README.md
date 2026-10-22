# SCATTER.EXE

One letter. 8 categories. 2:00. Score only the answers nobody else gave.

A daily Scattergories-style game. Every UTC day has one letter (never Q, X or Z) and 8 categories from a list of 150,
the same for everyone. Press START and you get two minutes to write one answer per category, each starting with the
letter (blank is allowed). Your sheet is sealed on a SHA-256 hash-chain ledger when the time is up.

- **Rules**: `public/engine/scatter.js`, loaded by the Worker, the page and the tests.
- **Worker**: `src/worker.js` (Cloudflare Worker + D1 `scatter-db`), API listed at the top of the file.
- **Ledger**: `src/ledger.js`. The day's entry holds its letter and categories; each sheet is its own entry.
- **Page**: `public/index.html` and `public/app.js`, an 80-column text frame in 4Dungeon's look.

Not built yet: comparing sheets at the end of the day (an answer nobody else gave scores 1, a shared one 0),
results, a ledger page, save codes and passkeys (shared Accounts), registry checkpoints.

## Setting it up

    npx wrangler d1 create scatter-db          # put its id in wrangler.jsonc
    npx wrangler d1 execute scatter-db --remote --file=schema.sql
    npm test
