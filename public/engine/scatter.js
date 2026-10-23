// SCATTER.EXE rules, loaded by both the Worker and the page. Change a rule here, once.
//
// One letter and 8 categories a UTC day, the same for everyone. You get 2:00 to write one answer per category, and
// an answer must start with the day's letter (or be blank). The day's pick is made when the day's ledger entry is
// sealed (src/ledger.js dayEntry), from the hash of the entry before it, so nobody can know it before the day starts.

export const TIME = 120;      // seconds to fill the sheet
export const GRACE = 10;      // a sheet that arrives more than this many seconds after the time is up is refused
export const PER_DAY = 8;     // categories a day
export const MAX_LEN = 40;    // characters in one answer

// every letter but Q, X and Z
export const LETTERS = "ABCDEFGHIJKLMNOPRSTUVWY".split("");

// 24 categories: five kept from the first list, and nineteen prompts that each have a few obvious answers to dodge.
// Anyone should be able to answer by imagination, with no real-life experience needed, and a category must fit the
// page: at most 36 characters.
export const CATEGORIES = [
  // Kept
  "Pizza toppings", "Ice cream flavours", "Boat names", "Wishes for a genie", "Superpowers you'd want",
  // Fresh
  "Cheat codes for real life", "Tiny superpowers", "Potion flavours", "Advice from an NPC",
  "Startups a dragon would found", "Secret society names", "Names for a band of wizards", "Ways to befriend a dragon",
  "Sidekick names", "Spells for a party", "New Pokemon types", "New names for the moon",
  "Rules a cat would make", "What robots love about humans",
  "What the final boss does on weekends", "Dungeon treasures", "Things a friendly ghost whispers",
  "Names for a hero's pet", "Side quests in a cozy village",
];

// A small seeded random number generator (mulberry32), from the first 8 hex digits of a hash.
function rng(hex) {
  let a = parseInt(hex.slice(0, 8), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The day's letter and categories, from a 64-digit hex hash. `recent` is the categories of earlier days, newest
// first: a category comes back only once the list runs out (the newest days are skipped first, as long as at least
// PER_DAY are left to pick from). Returns { letter, categories }.
export function pick(hex, recent = []) {
  const rand = rng(hex);
  const letter = LETTERS[Math.floor(rand() * LETTERS.length)];
  const used = new Set();
  for (const days of recent) {
    if (CATEGORIES.length - new Set([...used, ...days]).size < PER_DAY) break;
    for (const c of days) used.add(c);
  }
  const pool = CATEGORIES.filter((c) => !used.has(c));
  const categories = [];
  for (let i = 0; i < PER_DAY; i++) categories.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return { letter, categories };
}

// An answer as it is kept: spaces trimmed and squashed, at most MAX_LEN characters.
export const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);

// Does this answer count for the letter? Blank always does (it scores 0); otherwise its first character is the letter.
export const fits = (answer, letter) => { const a = clean(answer); return !a || a[0].toUpperCase() === letter; };

// When two answers count as the same: capitals, accents, spaces and punctuation don't matter ("Mr. Beast", "mr beast"
// and "MrBeast" are one answer; "Café" and "cafe" are one). Nothing else is merged: "Pikachus" is not "Pikachu", and a
// misspelling is a different answer. Blank (or nothing but marks) has no key. Every rule about sameness is this one line.
export const sameKey = (answer) => String(answer ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// The end-of-day tally. `sheets` is every sealed sheet of one day, each a list of PER_DAY answers. It counts, for each
// category, how many sheets gave each answer (by sameKey; only the same category counts): { players, counts }, where
// counts[i] is { key: how many }. Nothing in it says who. The Worker works it out once, after the day's last sheet.
export function tally(sheets) {
  const counts = Array.from({ length: PER_DAY }, () => ({}));
  for (const sheet of sheets) {
    for (let i = 0; i < PER_DAY; i++) { const k = sameKey(sheet[i]); if (k) counts[i][k] = (counts[i][k] || 0) + 1; }
  }
  return { players: sheets.length, counts };
}

// One sheet scored against the day's tally: for each category { answer, others, score }. `others` is how many other
// sheets gave the same answer; the score is 1 for an answer nobody else gave, 0 for a shared answer or a blank.
export const score = (answers, t) => Array.from({ length: PER_DAY }, (_, i) => {
  const answer = answers[i] ?? "", k = sameKey(answer);
  const others = k ? t.counts[i][k] - 1 : 0;
  return { answer, others, score: k && !others ? 1 : 0 };
});
