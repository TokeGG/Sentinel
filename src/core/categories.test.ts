import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryError, categoryOf, isCategory, parseCategoryList } from "./categories.ts";

test("categoryOf: declared wins, then default by id, then productivity", () => {
  assert.equal(categoryOf({ id: "hub.news", category: "finance" }), "finance");
  assert.equal(categoryOf({ id: "hub.pentest" }), "lab");
  assert.equal(categoryOf({ id: "hub.zzz" }), "productivity");
  assert.equal(categoryOf({ id: "hub.news", category: "bogus" }), "news");
});

test("categoryError + parseCategoryList", () => {
  assert.equal(categoryError(undefined), null);
  assert.equal(categoryError("lab"), null);
  assert.match(categoryError("games") ?? "", /category must be/);
  assert.deepEqual(parseCategoryList("news, deals lab, x, news"), ["news", "deals", "lab"]);
  assert.deepEqual(parseCategoryList(undefined), []);
  assert.ok(isCategory("mail") && !isCategory(3));
});
