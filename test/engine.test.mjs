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

test("the letters skip Q, X and Z; the list has 150 categories, none twice", () => {
  assert.equal(S.LETTERS.join(""), "ABCDEFGHIJKLMNOPRSTUVWY");
  assert.equal(S.CATEGORIES.length, 150);
  assert.equal(new Set(S.CATEGORIES).size, 150);
});

test("a pick is a letter and 8 different categories, the same for the same hash", () => {
  const h = "ab".repeat(32), p = S.pick(h);
  assert.ok(S.LETTERS.includes(p.letter));
  assert.equal(new Set(p.categories).size, 8);
  assert.deepEqual(S.pick(h), p);
});

test("categories don't come back until the list runs out", () => {
  // 18 earlier days use 144 categories: only 6 are left, fewer than 8, so the oldest day's come back
  const days = Array.from({ length: 18 }, (_, d) => S.CATEGORIES.slice(d * 8, d * 8 + 8)).reverse();   // newest first
  const p = S.pick("12".repeat(32), days);
  const newest17 = new Set(days.slice(0, 17).flat());
  assert.ok(p.categories.every((c) => !newest17.has(c)), "nothing from the newest 17 days");
  // with 17 days used (136), 14 are left: all 8 come from those
  const p2 = S.pick("34".repeat(32), days.slice(0, 17));
  assert.ok(p2.categories.every((c) => !newest17.has(c)));
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
