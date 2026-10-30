// Save codes, passkeys and the carried copy, through the shared Accounts and Registry services (the dungeon-items Worker,
// bound as ACCOUNTS and REGISTRY), like the other 88x31 games. Ported from moba-beat src/worker.js (v0.11).
//   GET  /api/account                    { player, id, codes, passkeys, devices, carry, copies }: who you are here, your
//                                        save codes and passkeys, the copy you carry (gold if the Moon blessed it) and
//                                        every copy your account holds in any game, newest first (up to 50)
//   POST /api/codes {action: "new"|"remove", id}   make a save code (shown once) or forget one
//   POST /api/load {code}                this browser becomes the player a save code belongs to
//   POST /api/passkey {action: register_options | register | login_options | login | remove}
//                                        (passkeys belong to 88x31.app, so they only work on an 88x31.app address)
//   POST /api/logout                     this browser forgets its player (needs a save code or passkey first)
//   POST /api/pin {itemId, copy}         carry that copy into every 88x31 game from now on
// Players are SCATTER.EXE's scatter_players (a cookie token's hash). A browser loaded later with a code or passkey gets
// its own row in scatter_sessions. SCATTER.EXE and TriviaMoba share these tables, each under its own game name.
import { sha256 } from "./ledger.js";

export function accounts({ GAME, cookieFor, clearCookie, readCookie, now, rateLimit, findPlayer, json, Oops }) {
  const ACC = (env) => { if (!env.ACCOUNTS) throw new Oops("Accounts are unavailable right now. Try again in a moment.", 503); return env.ACCOUNTS; };
  const ipOf = (req) => req.headers.get("cf-connecting-ip") || "unknown";
  const ok = (r) => { if (r && r.error) throw new Oops(r.error, r.status || 400); return r; };
  const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const body = async (req) => { let b; try { b = await req.json(); } catch {} if (!b || typeof b !== "object") throw new Oops("That request didn't make sense."); return b; };
  const newPlayer = async (env, token) => { const t = now(); return env.DB.prepare("INSERT INTO scatter_players (token_hash, created_at, seen_at) VALUES (?, ?, ?) RETURNING id").bind(await sha256(token), t, t).first(); };
  const must = async (ctx) => { const p = await findPlayer(ctx.req, ctx.env); if (!p) throw new Oops("No player here.", 401); return p; };
  const mine = async (ctx) => {   // this browser's player, made on the spot (for a first save code or passkey)
    const p = await findPlayer(ctx.req, ctx.env);
    if (p) return p;
    if (!(await rateLimit(ctx.env, ctx.req, "new-guest", 3, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
    const token = newToken(), r = await newPlayer(ctx.env, token);
    ctx.setCookie = cookieFor(token);
    return r;
  };

  async function accountFor(env, me, make = false) {
    const acc = ACC(env);
    let id = (await acc.accountOf(GAME, me.id)).accountId;
    if (id || !make) return id ?? null;
    id = (await acc.createAccount()).accountId;
    if (!ok(await acc.link(id, GAME, me.id)).linked) throw new Oops("That didn't work. Try again.");
    return id;
  }
  // This browser becomes the account's player here: the one it has, else this browser's own (if it has no account), else a new one.
  async function enter(ctx, accountId) {
    const { env } = ctx, acc = ACC(env);
    let { playerId } = await acc.playerFor(accountId, GAME);
    if (!playerId) {
      const cur = await findPlayer(ctx.req, env);
      if (cur && !(await acc.accountOf(GAME, cur.id)).accountId) playerId = cur.id;
      else {
        if (!(await rateLimit(env, ctx.req, "new-player", 20, 3600))) throw new Oops("Too many new players from here. Try again later.", 429);
        playerId = (await newPlayer(env, newToken())).id;
      }
      playerId = ok(await acc.link(accountId, GAME, playerId)).playerId;
    }
    const token = newToken();
    await env.DB.prepare("INSERT INTO scatter_sessions (token_hash, player_id, created_at, seen_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), playerId, now(), now()).run();
    ctx.setCookie = cookieFor(token);
  }

  async function account(ctx) {
    const me = await findPlayer(ctx.req, ctx.env);
    if (!me) return { player: false, codes: [], passkeys: [], devices: 0, carry: null, copies: [] };
    const id = await accountFor(ctx.env, me);
    const ways = id ? ok(await ACC(ctx.env).info(id)) : { codes: [], passkeys: [] };
    const devices = 1 + (await ctx.env.DB.prepare("SELECT COUNT(*) AS n FROM scatter_sessions WHERE player_id = ?").bind(me.id).first()).n;
    const [c, copies] = await Promise.all([carried(ctx.env, me.id), copiesOf(ctx.env, me.id)]);
    return { player: true, id: me.id, codes: ways.codes, passkeys: ways.passkeys, devices, carry: carryView(c), copies };
  }
  async function codes(ctx) {
    const b = await body(ctx.req);
    if (b.action === "new") { const me = await mine(ctx); return { code: ok(await ACC(ctx.env).addCode(await accountFor(ctx.env, me, true))).code }; }
    if (b.action === "remove") {
      const me = await must(ctx), id = await accountFor(ctx.env, me);
      if (!id) throw new Oops("No such save code.", 404);
      ok(await ACC(ctx.env).removeCode(id, Number(b.id)));
      return { ok: true };
    }
    throw new Oops("Unknown action.");
  }
  async function loadCode(ctx) {
    const r = ok(await ACC(ctx.env).loginCode({ code: (await body(ctx.req)).code, ip: ipOf(ctx.req) }));
    await enter(ctx, r.accountId);
    return { ok: true };
  }
  async function passkey(ctx) {
    const b = await body(ctx.req), { env, req } = ctx, acc = ACC(env), origin = new URL(req.url).origin;
    if (b.action === "login_options") return ok(await acc.passkeyLoginOptions({ origin, ip: ipOf(req) }));
    if (b.action === "login") { const r = ok(await acc.passkeyLogin({ origin, ip: ipOf(req), credential: b.credential })); await enter(ctx, r.accountId); return { ok: true }; }
    if (b.action === "register_options" || b.action === "register") {
      const me = await mine(ctx), accountId = await accountFor(env, me, true);
      if (b.action === "register_options") return ok(await acc.passkeyRegisterOptions({ accountId, origin }));
      return ok(await acc.passkeyRegister({ accountId, origin, credential: b.credential, label: b.label }));
    }
    if (b.action === "remove") {
      const me = await must(ctx), id = await accountFor(env, me);
      if (!id) throw new Oops("No such passkey.", 404);
      return ok(await acc.passkeyRemove(id, Number(b.id)));
    }
    throw new Oops("Unknown action.");
  }
  // This browser forgets its player, once there's a save code or passkey to get back in. A browser loaded later loses its
  // session; the first browser's token is replaced with one nobody has.
  async function logout(ctx) {
    const { env } = ctx, me = await findPlayer(ctx.req, env);
    if (!me) { ctx.setCookie = clearCookie; return { ok: true }; }
    const id = await accountFor(env, me);
    if (!(id ? await ACC(env).waysIn(id) : 0)) throw new Oops("Make a save code or passkey first, or you'd have no way back in.");
    const h = await sha256(readCookie(ctx.req));
    const s = await env.DB.prepare("DELETE FROM scatter_sessions WHERE token_hash = ?").bind(h).run();
    if (!s.meta.changes) await env.DB.prepare("UPDATE scatter_players SET token_hash = ? WHERE id = ? AND token_hash = ?").bind(await sha256(newToken()), me.id, h).run();
    ctx.setCookie = clearCookie;
    return { ok: true };
  }

  // ---------- the carried copy (copied from TILT.EXE v0.19) ----------
  // Your account's pinned copy from any game (the pin, else your newest copy). A Moon-blessed copy shows in gold. A
  // registry that's away, or no copy, carries nothing and never stops a game.
  async function carried(env, playerId) {
    try {
      const c = env.REGISTRY && env.REGISTRY.pinned ? await env.REGISTRY.pinned(GAME, playerId) : null;
      return c && c.itemId ? { ...c, blessed: c.marks.some((m) => m.kind === "moon" && m.value === "blessed") ? 1 : 0 } : null;
    } catch (e) { console.error(e); return null; }
  }
  const carryView = (c) => c ? { name: c.item.name, copy: c.copy, blessed: c.blessed } : null;
  // A deed mark made in this game on the copy the player carries, keyed so a retry makes no second mark.
  async function markCarry(env, playerId, value, key) {
    const c = await carried(env, playerId);
    if (!c) return;
    try {
      const r = await env.REGISTRY.markCarried({ itemId: c.itemId, copy: c.copy, by: { game: GAME, playerId }, kind: "deed", value, key });
      if (r && r.error) console.error("The registry refused the mark: " + r.error);
    } catch (e) { console.error(e); }
  }
  async function copiesOf(env, playerId) {
    try {
      const list = env.REGISTRY && env.REGISTRY.heldAcross ? await env.REGISTRY.heldAcross(GAME, playerId, 50) : [];
      return (list || []).map((c) => ({ itemId: c.itemId, copy: c.copy, name: c.item.name, game: c.game, pinned: c.pinned }));
    } catch (e) { console.error(e); return []; }
  }
  async function pinCopy(ctx) {
    const me = await must(ctx), b = await body(ctx.req);
    if (!ctx.env.REGISTRY) throw new Oops("The item registry is unavailable right now.", 503);
    ok(await ctx.env.REGISTRY.pin({ game: GAME, playerId: me.id, itemId: Number(b.itemId), copy: Number(b.copy) }));
    return { ok: true };
  }

  // The carry window (the footer's ≡): the registry's own page of every copy your account holds in any game, with the shared
  // save codes and passkeys and logging in and out (the routes above), in this game's frame (dungeon-items carry-window.js).
  // Its buttons pin through POST /api/pin. Same as scoundrel.exe's.
  //   GET  /api/carry[?embed=1]     the window, as a page
  async function carryPage(req, env) {
    const me = await findPlayer(req, env);
    if (!env.REGISTRY || !env.REGISTRY.carryWindow) throw new Oops("The registry is unavailable right now. Try again in a moment.", 503);
    const id = me ? await accountFor(env, me) : null;
    const ways = { player: !!me, ...(id ? ok(await ACC(env).info(id)) : { codes: [], passkeys: [] }) };
    const html = await env.REGISTRY.carryWindow({ game: GAME, playerId: me ? me.id : 0, pinUrl: "/api/pin", back: "/", ways, embed: new URL(req.url).searchParams.get("embed") === "1",
      frame: { title: "SCATTER.EXE   CARRY", paper: "#07090a", ink: "#e4e4df", edge: "#8f8f8a", accent: "#e3b341", font: '"VT323", ui-monospace, monospace' } });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }

  // Each route as the worker's (req, env) handler: its answer as JSON, with the cookie if one was set.
  const wrap = (f) => async (req, env) => {
    const ctx = { req, env, setCookie: null }, res = json(await f(ctx));
    if (ctx.setCookie) res.headers.append("set-cookie", ctx.setCookie);
    return res;
  };
  return {
    routes: {
      "GET /api/carry": carryPage,
      "GET /api/account": wrap(account), "POST /api/codes": wrap(codes), "POST /api/load": wrap(loadCode),
      "POST /api/passkey": wrap(passkey), "POST /api/logout": wrap(logout), "POST /api/pin": wrap(pinCopy),
    },
    markCarry,
  };
}

// The player a later browser's session token belongs to (or null). Used by findPlayer after scatter_players.
export async function sessionPlayer(env, hash, t) {
  const p = await env.DB.prepare("SELECT player_id AS id FROM scatter_sessions WHERE token_hash = ?").bind(hash).first();
  if (p) await env.DB.prepare("UPDATE scatter_sessions SET seen_at = ? WHERE token_hash = ?").bind(t, hash).run();
  return p;
}
