# SCATTER.EXE Changelog

Newest first. Times are Hawaii time (HST).

---

## v0.3.1 — "Footer Spot"
**Sat Oct 31, 2026 · 6:00 AM HST**

- The footer is drawn into its own spot under the screen and stays hidden until the game has drawn, so it no longer shows up alone in the middle of the screen. Removed: the footer's old wait-for-page-load.
- The ≡ in the footer is only a mark now; it no longer opens the save codes, passkeys and carry window. The accounts still work behind the scenes. Removed: the popup.

## Footer fixes
**Thu Oct 29, 2026 · 9:46 PM HST** (no new version: the game itself is unchanged)

- The shared footer (from dungeon-items) waits until the page has loaded before it shows, so it no longer appears alone in the middle of the screen first, and its text can be selected. Removed: nothing in this game (the change is in dungeon-items `footer.js`).
- The comment above the footer in `index.html` shows the footer's current text ("🄯 ~*~88x31~*~ · § ≡ version"). Removed: the old text in that comment ("© ~*~88x31~*~ cLuB, year · ≡ version").

## v0.3.0 — "Footer"
**Thu Oct 29, 2026**

- **The shared footer** from dungeon-items ("© ~*~88x31~*~ cLuB, year · ≡ v0.3.0"), the same line every 88x31 game shows. Its ≡ opens the carry window (`/api/carry`): save codes, passkeys, logging in and out, and your copies with Pin. Removed: the version line under the game.
- **No USER page.** Removed: the [USER] button and the full-screen USER page (`account.js`).

## v0.2.0 — "Carry"
**Mon Oct 26, 2026 · 12:39 AM HST**

- **[USER] under the game.** Save codes and passkeys, the shared 88x31 ones, so your player follows you to another browser and the other 88x31 games. Passkeys only work on an 88x31.app address.
- **Carry.** USER shows the copy you carry into every 88x31 game (gold if the Moon blessed it) and every copy your account holds in any game, with Pin to carry another. A sealed sheet with all 8 answers filled marks the copy you carry.
- New table `scatter_sessions` (`migrations/002_sessions.sql`), and the ACCOUNTS and REGISTRY bindings to dungeon-items.
- Removed: nothing.

---

## v0.1.1 — "Right Table"
**Thu Oct 22, 2026 · 12:22 AM HST**

- The live game reads and writes its tables in the moba-beat database, where they were made: `scatter_players`, `scatter_rate_limits`, `scatter_sheets` and `scatter_ledger`. Every query, `schema.sql` and `migrations/001_init.sql` use the `scatter_` names. This went live with the 12:22 AM merge; this entry and the version number were added after.
- Removed: the binding to `scatter-db` (made empty by the first build, no tables) and its blank database id.

---

## v0.1.0 — "First Letter"
**Wed Oct 21, 2026 · 10:18 PM HST**

- The first version. One letter and 8 categories a day, the same for everyone, picked when the day's first visitor arrives. Press START and you get 2:00 to write one answer per category; an answer that doesn't start with the letter turns red and can't be sent. When the time is up (or you press DONE) your sheet is sealed on the ledger. One try a day. Not built yet: comparing sheets, scores, results, save codes and passkeys.
