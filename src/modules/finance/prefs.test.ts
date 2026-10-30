import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFS, editCategories, fmtMoney, parsePrefs, sanitizePrefs } from "./prefs.ts";

test("prefs sanitize unknown values", () => {
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs("{bad"), DEFAULT_PREFS);
  const p = sanitizePrefs({ currency: "EUR", locale: "xx", cryptoMinutes: 7, blur: true, categories: [" A ", "A", ""], cash: 50 });
  assert.equal(p.currency, "EUR");
  assert.equal(p.locale, "en-US");
  assert.equal(p.cryptoMinutes, 60);
  assert.equal(p.blur, true);
  assert.deepEqual(p.categories, ["A"]);
  assert.equal(p.cash, 50);
});

test("fmtMoney uses currency and locale", () => {
  assert.equal(fmtMoney(1234.5, { currency: "USD", locale: "en-US" }), "$1,234.50");
  assert.match(fmtMoney(1234.5, { currency: "EUR", locale: "de-DE" }), /1\.234,50\s?€/);
  assert.equal(fmtMoney(0.1234567, { currency: "USD", locale: "en-US" }), "$0.1235");
  assert.equal(fmtMoney(null), "—");
});

test("category editor", () => {
  assert.deepEqual(editCategories(["A"], "add", "B"), ["A", "B"]);
  assert.deepEqual(editCategories(["A"], "add", "A"), ["A"]);
  assert.deepEqual(editCategories(["A", "B"], "rename", "A", "C"), ["C", "B"]);
  assert.deepEqual(editCategories(["A", "B"], "rename", "A", "B"), ["A", "B"]);
  assert.deepEqual(editCategories(["A", "B"], "remove", "A"), ["B"]);
});
