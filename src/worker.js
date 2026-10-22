// SCATTER.EXE Worker. The page and its files are static assets; /api/* comes here first.
//
//   GET  /api/today                  { day, nextIn, time, state, ... }: today's date in UTC (from the server's clock, so
//                                    a wrong phone clock can't pick another day) and where your sheet is:
//                                      new      not started (the letter and categories stay hidden until you start)
//                                      playing  started, time left: letter, categories, left (seconds)
//                                      sealed   letter, categories, your answers, and the sheet's ledger entry and hash
//                                      late     started, but the time (and its grace) ran out before a sheet came
//   POST /api/start                  start today's sheet: the server keeps the start time (once a day). Same answer as today.
//   POST /api/sheet {day, answers}   seal your sheet on the ledger: 8 answers, each blank or starting with the letter,
//                                    within the time plus GRACE seconds of your start
//
// The rules are public/engine/scatter.js, the same file the page loads.

import { sha256, head, sheetInsert, dayEntry, isUnique } from "./ledger.js";
import * as S from "../public/engine/scatter.js";

const COOKIE = "sx";
const COOKIE_MAX_AGE = 400 * 86400;
const SEEN_EVERY = 900;   // 15 minutes

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (env.CANONICAL_HOST && url.hostname.endsWith(".workers.dev")) {
      return Response.redirect(`https://${env.CANONICAL_HOST}${url.pathname}${url.search}`, 301);
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(req) : new Response("Not found", { status: 404 });
    try {
      const route = ROUTES[`${req.method} ${url.pathname}`];
      if (!route) return json({ error: "No such thing." }, 404);
      return await route(req, env, url);
    } catch (e) {
      if (e instanceof Oops) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something broke. Try again in a moment." }, 500);
    }
  },
};

class Oops extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const ROUTES = {
  "GET /api/today": today,
  "POST /api/start": start,
  "POST /api/sheet": seal,
};

// ---------- helpers (copied from clutch-feed-tilt src/worker.js) ----------

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

// the clock, in unix seconds (tests move it with setClock)
let clock = () => Math.floor(Date.now() / 1000);
export function setClock(fn) { clock = fn; }
const now = () => clock();
const utcDay = (t = now()) => new Date(t * 1000).toISOString().slice(0, 10);
const dayEnd = (day) => Date.parse(day + "T00:00:00Z") / 1000 + 86400;

function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readCookie(req) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,})`));
  return m ? m[1] : null;
}

const setCookie = (token) => `${COOKIE}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
const withCookie = (res, cookie) => { if (cookie) res.headers.append("set-cookie", cookie); return res; };

// The player behind this request's cookie, or null. Never creates one (so crawlers don't make players).
async function findPlayer(req, env) {
  const token = readCookie(req);
  if (!token) return null;
  const p = await env.DB.prepare("SELECT id, seen_at FROM scatter_players WHERE token_hash = ?").bind(await sha256(token)).first();
  if (!p) return null;
  if (now() - p.seen_at >= SEEN_EVERY) await env.DB.prepare("UPDATE scatter_players SET seen_at = ? WHERE id = ?").bind(now(), p.id).run();
  return p;
}

// The player behind this request, made on the spot if there isn't one. Returns { player, cookie? }.
async function needPlayer(req, env) {
  const found = await findPlayer(req, env);
  if (found) return { player: found };
  if (!(await rateLimit(env, req, "new-guest", 3, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
  const token = newToken(), t = now();
  const r = await env.DB.prepare("INSERT INTO scatter_players (token_hash, created_at, seen_at) VALUES (?, ?, ?) RETURNING id")
    .bind(await sha256(token), t, t).first();
  return { player: r, cookie: setCookie(token) };
}

// Fixed window per hashed IP and action. Returns true if allowed.
async function rateLimit(env, req, action, limit, windowSecs) {
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const key = action + ":" + (await sha256("ip:" + ip)).slice(0, 32);
  const t = now(), windowStart = t - (t % windowSecs);
  const row = await env.DB.prepare(
    `INSERT INTO scatter_rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`).bind(key, windowStart).first();
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM scatter_rate_limits WHERE window_start < ?").bind(t - 86400).run();
  return row.count <= limit;
}

async function body(req) {
  try { return await req.json(); } catch { throw new Oops("That request didn't make sense."); }
}

// ---------- the sheet ----------

// Where this player's sheet for the day is (see the API above).
async function view(env, player, day) {
  const out = { day, nextIn: dayEnd(day) - now(), time: S.TIME, state: "new" };
  const s = player && await env.DB.prepare(
    `SELECT s.started_at, s.answers, l.id AS entry, l.hash FROM scatter_sheets s LEFT JOIN scatter_ledger l ON l.kind = 'sheet' AND l.sheet_id = s.id
     WHERE s.player_id = ? AND s.day = ?`).bind(player.id, day).first();
  if (!s) return out;
  const { letter, categories } = await dayEntry(env.DB, day, now());
  const left = s.started_at + S.TIME - now();
  if (s.answers) return { ...out, state: "sealed", letter, categories, answers: JSON.parse(s.answers), entry: s.entry, hash: s.hash };
  if (left + S.GRACE < 0) return { ...out, state: "late" };
  return { ...out, state: "playing", letter, categories, left: Math.max(0, left) };
}

async function today(req, env) {
  const day = utcDay();
  await dayEntry(env.DB, day, now());   // the first request of the day seals it, so the pick is fixed early
  return json(await view(env, await findPlayer(req, env), day));
}

// Start today's sheet. Starting again does nothing: the first start time stands.
async function start(req, env) {
  const day = utcDay();
  await dayEntry(env.DB, day, now());
  const { player, cookie } = await needPlayer(req, env);
  await env.DB.prepare("INSERT INTO scatter_sheets (player_id, day, started_at) VALUES (?, ?, ?) ON CONFLICT (player_id, day) DO NOTHING")
    .bind(player.id, day, now()).run();
  return withCookie(json(await view(env, player, day)), cookie);
}

// Seal a sheet: its answers and its ledger entry in one D1 batch.
async function seal(req, env) {
  const b = await body(req);
  const player = await findPlayer(req, env);
  if (!player) throw new Oops("Press START first.", 401);
  const s = typeof b.day === "string" && await env.DB.prepare("SELECT id, day, started_at, answers FROM scatter_sheets WHERE player_id = ? AND day = ?")
    .bind(player.id, b.day).first();
  if (!s) throw new Oops("Press START first.", 404);
  if (s.answers) throw new Oops("Your sheet is already sealed.", 409);
  const t = now();
  if (t > s.started_at + S.TIME + S.GRACE) throw new Oops("Time ran out before your sheet arrived. It wasn't sealed.", 409);
  const { letter, categories } = await dayEntry(env.DB, s.day, t);
  if (!Array.isArray(b.answers) || b.answers.length !== categories.length) throw new Oops(`A sheet has ${categories.length} answers.`);
  const answers = b.answers.map(S.clean);
  const bad = answers.findIndex((a) => !S.fits(a, letter));
  if (bad >= 0) throw new Oops(`"${answers[bad]}" doesn't start with ${letter}.`);
  const record = JSON.stringify({ day: s.day, player: player.id, letter, answers, started: s.started_at, t });
  for (let i = 0; i < 6; i++) {
    const stmts = [
      env.DB.prepare("UPDATE scatter_sheets SET answers = ?, sealed_at = ? WHERE id = ? AND answers IS NULL").bind(JSON.stringify(answers), t, s.id),
      await sheetInsert(env.DB, await head(env.DB), { day: s.day, sheetId: s.id, record, t }),
    ];
    let res;
    try { res = await env.DB.batch(stmts); }
    catch (e) {
      if (!isUnique(e)) throw e;
      // someone else sealed something first: build on the new head (unless it was this same sheet, sent twice)
      if ((await env.DB.prepare("SELECT answers FROM scatter_sheets WHERE id = ?").bind(s.id).first()).answers) throw new Oops("Your sheet is already sealed.", 409);
      continue;
    }
    if (!res[0].meta.changes) throw new Oops("Your sheet is already sealed.", 409);
    return json(await view(env, player, s.day));
  }
  throw new Error("The ledger is busy. Try again.");
}
