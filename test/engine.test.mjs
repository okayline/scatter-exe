// The rules in public/engine/scatter.js, and the version against the changelog. Expected values are worked out by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../public/engine/scatter.js";
import { VERSION } from "../public/engine/version.js";

test("the newest CHANGELOG.md heading is VERSION", () => {
  const h = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8").match(/^## v(\S+)/m);
  assert.equal(h[1], VERSION);
});

test("the letters skip Q, X and Z; no category is listed twice, and each fits the page", () => {
  assert.equal(S.LETTERS.join(""), "ABCDEFGHIJKLMNOPRSTUVWY");
  assert.equal(new Set(S.CATEGORIES).size, S.CATEGORIES.length);
  assert.ok(S.CATEGORIES.every((c) => c.length <= 36), "the page gives a category 36 columns");
});

test("a pick is a letter and 8 different categories, the same for the same hash", () => {
  const h = "ab".repeat(32), p = S.pick(h);
  assert.ok(S.LETTERS.includes(p.letter));
  assert.equal(new Set(p.categories).size, 8);
  assert.deepEqual(S.pick(h), p);
});

test("categories don't come back until the list runs out", () => {
  // as many whole days as the list holds use all but fewer than 8 categories, so the oldest day's come back
  const full = Math.floor(S.CATEGORIES.length / 8);
  const days = Array.from({ length: full }, (_, d) => S.CATEGORIES.slice(d * 8, d * 8 + 8)).reverse();   // newest first
  const p = S.pick("12".repeat(32), days);
  const newest = new Set(days.slice(0, full - 1).flat());
  assert.ok(p.categories.every((c) => !newest.has(c)), "nothing from the newest days");
  // one day fewer used: at least 8 are left, and all 8 come from those
  const p2 = S.pick("34".repeat(32), days.slice(0, full - 1));
  assert.ok(p2.categories.every((c) => !newest.has(c)));
});

test("an answer fits if it is blank or starts with the letter (any case); spaces are trimmed and squashed", () => {
  assert.equal(S.fits("", "P"), true);
  assert.equal(S.fits("   ", "P"), true);
  assert.equal(S.fits("  psyduck", "P"), true);
  assert.equal(S.fits("Pikachu", "P"), true);
  assert.equal(S.fits("Bulbasaur", "P"), false);
  assert.equal(S.clean("  mr   beast  "), "mr beast");
  assert.equal(S.clean("x".repeat(50)).length, 40);
});

test("two answers are the same when only capitals, accents, spaces or punctuation differ", () => {
  for (const a of ["Mr. Beast", "mr beast", "MrBeast", "  MR-BEAST!  "]) assert.equal(S.sameKey(a), "mrbeast");
  assert.equal(S.sameKey("Café"), "cafe");
  assert.equal(S.sameKey("Pikachus") === S.sameKey("Pikachu"), false, "plurals and misspellings are different answers");
  assert.equal(S.sameKey(""), "");
  assert.equal(S.sameKey(" -- "), "", "nothing but marks is blank");
});

test("the tally counts each answer per category; a sheet scores 1 for an answer nobody else gave, 0 for a shared answer or a blank", () => {
  const row = (...a) => [...a, ...Array(8 - a.length).fill("")];
  // category 1: pie (A, B) and pear (C);  2: pea (A, C);  3: plum (A);  4: pie (A);  5: pie (C)
  const A = row("Pie", "Pea", "Plum", "Pie"), B = row("pie"), C = row("Pear.", "Pea!", "", "", "Pie");
  const t = S.tally([A, B, C]);
  assert.equal(t.players, 3);
  assert.deepEqual(t.counts.map((c) => ({ ...c })), [{ pie: 2, pear: 1 }, { pea: 2 }, { plum: 1 }, { pie: 1 }, { pie: 1 }, {}, {}, {}]);
  const [a, b, c] = [A, B, C].map((x) => S.score(x, t));
  assert.deepEqual(a.map((r) => r.score), [0, 0, 1, 1, 0, 0, 0, 0]);
  assert.deepEqual(a.map((r) => r.others), [1, 1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(b.map((r) => r.score), [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(b.map((r) => r.others), [1, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(c.map((r) => r.score), [1, 0, 0, 0, 1, 0, 0, 0], "the same word in another category is not a clash");
  assert.deepEqual(c.map((r) => r.others), [0, 1, 0, 0, 0, 0, 0, 0]);
  assert.equal(c[0].answer, "Pear.", "the answer is returned as it was written");
  assert.deepEqual(S.score(A, S.tally([A])).map((r) => r.score), [1, 1, 1, 1, 0, 0, 0, 0], "alone, every answer is unique");
});
