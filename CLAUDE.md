# Working notes for scatter-exe

## Rules for every repo

- **Push only when the user says to.** Build and commit locally as asked.
- **Ask before adding anything that wasn't asked for** (a button, a screen, a message, a page, a feature), even a small one. The owner would rather be asked than remove it later.
- **Keep testing quick: 2-3 mins at most. Don't test for edge cases.**
- **No new dependencies** without asking.
- Times in changelogs are Hawaii time (HST).


SCATTER.EXE: a daily Scattergories-style game. One letter and 8 categories a UTC day, the same for everyone, 2:00 to write one answer per category. Design doc: the Claude Doc "SCATTER.EXE: design idea" (https://claude.ai/artifact/5ciLoQfVvzGnNexwwZQ1rx).

- **Push only when the user says to.** Once the Worker is connected to this repo, a push to `main` is a release.
- **The rules live in one file**, `public/engine/scatter.js` (letters, categories, the day's pick, what an answer must look like), loaded by the Worker, the page and the tests. Change a rule there, once.
- **The ledger is a hash chain** (`src/ledger.js`): a `day` entry (its record is the day's letter and categories, picked from the hash before it) and one `sheet` entry per player per day, written in the same D1 batch as the sheet. Records hold player ids, never names. Don't weaken `prev_hash UNIQUE`.
- **Sheets stay secret until the day closes.** The letter and categories are only sent to a player once they press START, and the server keeps the start time.
- The frame, font and colours are copied from TILT.EXE (`clutch-feed-tilt/public/index.html`, itself from 4Dungeon); `public/fonts/VT323-Regular.ttf` is OFL (see `OFL.txt`).
- **Database changes** need a file in `migrations/`, `schema.sql` updated to match, and the live `moba-beat` database migrated before the push that needs it. SCATTER.EXE's tables live there (shared with moba-beat and Daily Pitch), every one named `scatter_...`.
- **Keep testing quick**: `npm test` must pass before any commit, plus one quick check of whatever changed. Expected values come from hand-worked examples or node:crypto, not the code under test.
- Every release bumps `VERSION` in `public/engine/version.js` and adds a `CHANGELOG.md` entry (a test checks they match). No new dependencies without asking. Times in changelogs are Hawaii time (HST). No browser popups (confirm/alert/prompt).

## Working rules

The same seventeen rules are in every Dungeons repo and in the project instructions. "ryan" is the owner.

**Honesty (never broken)**
1. Never lie. State as fact only what you opened, read or ran this turn. Everything else gets "Not checked" in the same sentence, or isn't said.
2. Don't infer from the surface. READMEs, titles, file names, comments, timestamps, summaries and earlier replies are leads to check, not facts.
3. Quote it or don't claim it. Don't describe how code, a table, a page or a ledger works, or say something exists or is missing, until you have opened it in this conversation. Give file and line, quoted.
4. Opinions are labelled "my opinion". Hedges like "should work" or "probably" are labelled "not checked".
5. Every answer about code or data ends with "Opened:" (files and lines read this turn) and "Not checked:". If "Opened:" would be empty, open the files before answering.
6. Check first, then reply once. No "I'll look into it" message followed by an answer from memory.
7. If you were wrong, the first sentence says what you said, what is true, and the source.
8. Never say something was done, pushed or fixed unless you saw it succeed. Say what ran and what didn't, and report failures plainly.

**Searching**
9. Search before saying "no": project chat and threads, all eight repos, and the live state. List what was and wasn't searched. Say "I couldn't find it", never "that isn't true", and never "everything". Treat ryan's memory as true until a search disproves it.
10. Before recommending anything new, search the code for whether it already exists, and say what you found.

**Design and proposals**
11. Give honest design answers, including "this isn't worth building". Give one recommendation. Mention "do nothing" only if it is actually the best option. Never tell ryan to play or playtest the game.
12. Before proposing, name the goal it serves (4Dungeon: design doc section 15), what it adds, takes away and touches, what it replaces or lets us delete, what already exists, and how it would most likely fail. No goal means no proposal. Propose the smallest version first.

**Building**
13. Build, push, change tables or scheduled tasks, or add a dependency only when ryan asks. Don't touch anything not asked for, and list extras for approval.
14. Delete, don't park: no new flags or "off for now" code. Fix a shared problem once, in the shared place.
15. Each changelog line says what was removed as well as what was added.

**Working with ryan**
16. Silence means "not now": no nagging, and raise each item at most once.
17. Disagree before building, not after. A bare "ok" to a long answer is not approval of everything in it.
