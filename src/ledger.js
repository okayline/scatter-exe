// The ledger: one SHA-256 hash chain, one entry per UTC day and one per sealed sheet. Same design as the other games'
// ledgers; the helpers are copied from clutch-feed-tilt src/ledger.js (which copied aura-farm and scoundrel.exe).
//
//   hash = SHA-256( prev_hash + "|" + record )
//
// Two kinds of entry:
//   day    { day, letter, categories }: sealed by the first request that needs the day. The letter and categories
//          are picked from prev_hash (the chain's head when the day was sealed, scatter.js pick), so they can't be
//          known before the day starts, and they are fixed on the chain for good.
//   sheet  { day, player, letter, answers, started }: a player's sheet, sealed when their time is up (or they hit DONE),
//          in the same D1 batch as the sheet itself, so a sheet is saved if and only if it is on the ledger.
//          Records hold player ids, never names.
//
// The first entry chains from GENESIS. Changing any old record breaks its hash and every hash after it.
// prev_hash is UNIQUE, so two entries can never build on the same head (no forks).

import { pick, PER_DAY, CATEGORIES } from "../public/engine/scatter.js";

export const GENESIS = "0".repeat(64);

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function head(db) {
  const h = await db.prepare("SELECT hash FROM ledger ORDER BY id DESC LIMIT 1").first();
  return h ? h.hash : GENESIS;
}

export const isUnique = (e) => /UNIQUE/i.test(String(e && e.message));

// The insert for one sheet's entry chained from `prev`. The sheet is sealed earlier in the same batch; the entry goes
// in only if that happened (sealed_at = t).
export async function sheetInsert(db, prev, { day, sheetId, record, t }) {
  const hash = await sha256(prev + "|" + record);
  return db.prepare(
    `INSERT INTO ledger (kind, day, sheet_id, record, prev_hash, hash, created_at)
     SELECT 'sheet', ?1, id, ?2, ?3, ?4, ?5 FROM sheets WHERE id = ?6 AND sealed_at = ?5`)
    .bind(day, record, prev, hash, t, sheetId);
}

// The day's entry: { letter, categories }, sealing it first if it isn't on the chain yet. Two requests at once can't
// both seal one: a day has one entry (ledger_one_day) and the chain can't fork (prev_hash UNIQUE), so the loser reads
// the winner's.
export async function dayEntry(db, day, t) {
  for (let i = 0; i < 4; i++) {
    const got = await db.prepare("SELECT record FROM ledger WHERE kind = 'day' AND day = ?").bind(day).first();
    if (got) { const r = JSON.parse(got.record); return { letter: r.letter, categories: r.categories }; }
    // the categories of the days before, newest first: enough of them to cover the whole list
    const { results } = await db.prepare("SELECT record FROM ledger WHERE kind = 'day' ORDER BY id DESC LIMIT ?")
      .bind(Math.ceil(CATEGORIES.length / PER_DAY)).all();
    const prev = await head(db);
    const { letter, categories } = pick(prev, results.map((r) => JSON.parse(r.record).categories));
    const record = JSON.stringify({ day, letter, categories });
    try {
      await db.prepare("INSERT INTO ledger (kind, day, sheet_id, record, prev_hash, hash, created_at) VALUES ('day', ?, NULL, ?, ?, ?, ?)")
        .bind(day, record, prev, await sha256(prev + "|" + record), t).run();
      return { letter, categories };
    } catch (e) { if (!isUnique(e)) throw e; }
  }
  throw new Error("the ledger is busy");
}
