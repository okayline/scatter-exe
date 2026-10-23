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

// The starter list from the design doc ("SCATTER.EXE: design idea", Oct 22 2026), 150 categories in five groups.
export const CATEGORIES = [
  // Gaming
  "Pokemon", "Video game characters", "Video game villains", "Video games", "Game consoles or handhelds",
  "Things you yell at a teammate", "Excuses after losing", "Bosses you rage quit on", "Things in a Minecraft chest",
  "Fortnite skins", "Fighting game characters", "Mario Kart tracks or items", "Video game weapons", "Game studios",
  "Things in a loot box", "Gamer words (gg, nerf, op...)", "Gamer tags you'd never use", "RPG classes",
  "Things in a dungeon", "Zelda things", "Mobile games", "Card or board games", "Esports teams or players",
  "Things that lag", "Video game sound effects", "Potions or power-ups", "Things a final boss would say",
  "Game genres", "Retro game things", "Reasons to stay up until 4am",
  // Internet
  "Memes", "Websites", "Apps on your phone", "YouTubers", "Streamers", "Things that went viral", "Internet slang",
  "Gen-z slang", "Emojis (in words)", "Usernames", "Things in a comment section", "Subreddits", "TikTok trends",
  "Reasons you got banned", "Things you Google at 3am", "Things in a group chat", "Bad passwords",
  "Things that need an update", "Things a Discord mod says", "Podcast names", "Things people review online",
  "Clickbait titles", "Things you unsubscribe from", "Influencer products", "Wi-Fi network names",
  "Things with a loading bar", "Crypto words", "Things that got cancelled", "Reasons to log off",
  "Things you screenshot",
  // Pop culture
  "Movies", "TV shows", "Anime", "Anime characters", "Superheroes", "Villains", "Cartoon characters", "Songs",
  "Bands or rappers", "Celebrities", "Famous animals", "Horror movie monsters", "Star Wars things", "Movie quotes",
  "Reality TV shows", "Fictional places", "Wizards or witches", "Robots or AIs", "Book titles", "Sports teams",
  "Athletes", "Brands", "Fast food chains", "Cereals", "Sneakers or shoe brands",
  // Silly and everyday
  "Things in a fridge", "Snacks", "Pizza toppings", "Things at a gas station", "Things in a junk drawer",
  "Things you shouldn't microwave", "Things that are sticky", "Things that smell bad", "Things a cat knocks over",
  "Bad pet names", "Animals", "Animals that would win a fight", "Things for the zombie apocalypse",
  "Things in your pocket", "Reasons to be late", "Things your mom says", "Things a pirate says",
  "Things you whisper", "Things that are round", "Things that are loud", "Words that sound funny", "Food at 2am",
  "Ice cream flavours", "Drinks", "Things at a sleepover", "Things in a backpack", "Bad tattoo ideas",
  "Crimes you'd only do in GTA", "Boat names", "Things to buy with a million dollars", "Body parts",
  "Things that break", "Things in a haunted house", "Famous last words", "Things you'd say to a ghost",
  // Places, things and vibes
  "Countries", "Cities", "US states", "Things in space", "Jobs", "Fantasy jobs", "Things at a theme park",
  "Things at school", "Classes at wizard school", "Things at the beach", "Things in a castle", "Mythical creatures",
  "Gods or legends", "Dinosaurs", "Things that fly", "Vehicles", "Tools", "Sports", "Dances", "Hairstyles",
  "Clothes", "Colours", "Things with wheels", "Things in a casino", "Things that are cursed",
  "Main character moments", "Things that are mid", "Red flags", "Things that give you aura", "NPC behaviour",
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
