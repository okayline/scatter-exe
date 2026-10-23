# SCATTER.EXE Changelog

Newest first. Times are Hawaii time (HST).

---

## v0.2.0 — "Compared"
**Thu Oct 22, 2026 · 5:46 PM HST**

- Results. Once a day is over, [R]ESULTS (or the R key) on the main screen shows yesterday's sheet next to everyone's: for each category your answer and either NOBODY ELSE +1 or how many others wrote the same, and your total out of 8. Only your own answers are shown, never anyone else's, and a day's results aren't available until it is over. Removed: the line "(COMPARING SHEETS AND SCORES ARE NOT BUILT YET.)" from the first screen.
- What counts as the same answer: capitals, accents, spaces and punctuation don't matter ("Mr. Beast", "mr beast" and "MrBeast" are one answer). Plurals and misspellings are different answers. Removed: nothing.
- New category list, 24 long, down from 150. In: Cheat codes for real life, Tiny superpowers, Potion flavours, Advice from an NPC, Startups a dragon would found, Secret society names, Names for a band of wizards, Ways to befriend a dragon, Sidekick names, Spells for a party, New Pokemon types, New names for the moon, Rules a cat would make, What robots love about humans, What the final boss does on weekends, Dungeon treasures, Things a friendly ghost whispers, Names for a hero's pet, Side quests in a cozy village, plus Wishes for a genie and Superpowers you'd want. Kept from the first list: Pizza toppings, Ice cream flavours, Boat names. Removed: the other 143 of the first 150, which were stock Scattergories prompts (Movies, Songs, Things at a theme park...), general knowledge (Countries, Animals, Colours...), prompts that need real-life experience (Things at the beach, in a hotel room...), Bad passwords and Wi-Fi network names, Dog names and Cat names. Halloween costumes, Things at a birthday party, Things on a sandwich, Reasons to call in sick, Excuses to leave a party and Magic sandwich ingredients were added earlier in this release and are gone again.
- A day's tally (how many sheets gave each answer, per category) is worked out once and kept, so showing results reads one stored row however many people played. It waits until 2 minutes 10 seconds after midnight UTC, the last moment a sheet started at the very end of the day can still arrive. New table `scatter_tally` (`migrations/002_tally.sql`, to be run on the moba-beat database before the release). Removed: nothing.

---

## v0.1.1 — "Right Table"
**Thu Oct 22, 2026 · 12:22 AM HST**

- The live game reads and writes its tables in the moba-beat database, where they were made: `scatter_players`, `scatter_rate_limits`, `scatter_sheets` and `scatter_ledger`. Every query, `schema.sql` and `migrations/001_init.sql` use the `scatter_` names. This went live with the 12:22 AM merge; this entry and the version number were added after.
- Removed: the binding to `scatter-db` (made empty by the first build, no tables) and its blank database id.

---

## v0.1.0 — "First Letter"
**Wed Oct 21, 2026 · 10:18 PM HST**

- The first version. One letter and 8 categories a day, the same for everyone, picked when the day's first visitor arrives. Press START and you get 2:00 to write one answer per category; an answer that doesn't start with the letter turns red and can't be sent. When the time is up (or you press DONE) your sheet is sealed on the ledger. One try a day. Not built yet: comparing sheets, scores, results, save codes and passkeys.
