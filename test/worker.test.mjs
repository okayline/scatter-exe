// End-to-end tests of the Worker API, with Node's built-in SQLite standing in for D1.
// Hashes are recomputed with node:crypto, not the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker, { setClock } from "../src/worker.js";
import { pick } from "../public/engine/scatter.js";

// a tiny D1 lookalike (copied from clutch-feed-tilt test/worker.test.mjs)
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const prep = (sql, args = []) => ({
    sql, args,
    bind: (...a) => prep(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
  });
  const batch = async (stmts) => {
    db.exec("BEGIN");
    try {
      const out = stmts.map((st) => /^\s*(SELECT|WITH)/i.test(st.sql) || /RETURNING/i.test(st.sql)
        ? { results: db.prepare(st.sql).all(...st.args), meta: { changes: 0 } }
        : { results: [], meta: { changes: db.prepare(st.sql).run(...st.args).changes } });
      db.exec("COMMIT");
      return out;
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  return { prepare: (sql) => prep(sql), batch, raw: db };
}

const sha = (t) => createHash("sha256").update(t).digest("hex");
const T0 = Date.parse("2027-01-01T08:00:00Z") / 1000;

function setup() {
  let t = T0;
  setClock(() => t);
  const env = { DB: fakeD1() };
  const jar = {};
  const call = async (who, method, path, body) => {
    const headers = { "content-type": "application/json" };
    if (jar[who]) headers.cookie = jar[who];
    const res = await worker.fetch(new Request("https://scatter.test" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
    for (const c of res.headers.getSetCookie()) jar[who] = c.split(";")[0];
    return { status: res.status, ...(await res.json()) };
  };
  return { env, call, wait: (s) => (t += s) };
}

test("the day's entry is sealed by the first request; its letter and categories come from the genesis hash and stay hidden until you start", async () => {
  const { env, call } = setup();
  const t = await call("ann", "GET", "/api/today");
  assert.deepEqual(t, { status: 200, day: "2027-01-01", nextIn: 16 * 3600, time: 120, state: "new" });
  const p = pick("0".repeat(64)), rec = JSON.stringify({ day: "2027-01-01", ...p });
  assert.deepEqual(env.DB.raw.prepare("SELECT kind, record, prev_hash, hash FROM scatter_ledger").all().map((r) => ({ ...r })),
    [{ kind: "day", record: rec, prev_hash: "0".repeat(64), hash: sha("0".repeat(64) + "|" + rec) }]);
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM scatter_players").get().n, 0, "just looking makes no player");
  const s = await call("ann", "POST", "/api/start");
  assert.equal(s.state, "playing");
  assert.equal(s.letter, p.letter);
  assert.deepEqual(s.categories, p.categories);
  assert.equal(s.left, 120);
});

test("a sheet is sealed once, on the ledger, with clean answers; a wrong letter or a late sheet is refused", async () => {
  const { env, call, wait } = setup();
  const s = await call("ann", "POST", "/api/start"), L = s.letter;
  wait(30);
  assert.equal((await call("ann", "POST", "/api/start")).left, 90, "starting again doesn't restart the clock");
  const answers = [`  ${L.toLowerCase()}ne   two `, "", ...Array(6).fill(L + "x")];
  const wrong = [...answers]; wrong[3] = "Q" + "nope";
  assert.equal((await call("ann", "POST", "/api/sheet", { day: s.day, answers: wrong })).status, 400);
  assert.equal((await call("ann", "POST", "/api/sheet", { day: s.day, answers: answers.slice(1) })).status, 400);
  const done = await call("ann", "POST", "/api/sheet", { day: s.day, answers });
  assert.equal(done.state, "sealed");
  const kept = [`${L.toLowerCase()}ne two`, "", ...Array(6).fill(L + "x")];
  assert.deepEqual(done.answers, kept);
  const [day, sheet] = env.DB.raw.prepare("SELECT kind, record, prev_hash, hash FROM scatter_ledger ORDER BY id").all();
  const rec = JSON.stringify({ day: s.day, player: 1, letter: L, answers: kept, started: T0, t: T0 + 30 });
  assert.equal(sheet.record, rec);
  assert.equal(sheet.prev_hash, day.hash);
  assert.equal(sheet.hash, sha(day.hash + "|" + rec));
  assert.equal(done.hash, sheet.hash);
  assert.equal((await call("ann", "POST", "/api/sheet", { day: s.day, answers })).status, 409, "only once");
  // bo starts and is 131 seconds late
  const b = await call("bo", "POST", "/api/start");
  wait(131);
  assert.equal((await call("bo", "POST", "/api/sheet", { day: b.day, answers: Array(8).fill("") })).status, 409);
  assert.equal((await call("bo", "GET", "/api/today")).state, "late");
  assert.equal(env.DB.raw.prepare("SELECT COUNT(*) AS n FROM scatter_ledger WHERE kind = 'sheet'").get().n, 1);
});
