import test from "node:test";
import assert from "node:assert/strict";
import { inferCategories, pickSkillsFor, scoreSkills } from "./skillPick.ts";

const sk = (name: string, description: string, categories: string[] = [], body = "") => ({ name, description, body, categories });
const all = [sk("inbox-triage", "sort unread email by importance", ["mail"]), sk("deal-worth-it", "judge if a price is a good deal", ["deals"]),
  sk("scope-hygiene-check", "check engagement scope entries", ["lab"]), sk("news-digest", "summarize headlines", ["news"])];

test("inferCategories reads intent from the goal", () => {
  assert.equal(inferCategories("is this coupon a cheap price?")[0], "deals");
  assert.equal(inferCategories("clean my inbox emails")[0], "mail");
  assert.deepEqual(inferCategories("zzz"), []);
});

test("pickSkillsFor picks the skill geared to the goal, plurals and dashes included", () => {
  assert.deepEqual(pickSkillsFor("triage my emails", all).map((s) => s.name), ["inbox-triage"]);
  assert.deepEqual(pickSkillsFor("is this deal worth it", all).map((s) => s.name)[0], "deal-worth-it");
  assert.deepEqual(pickSkillsFor("zzz qqq", all), []);
});

test("category boost and only filter", () => {
  const two = [sk("a-summary", "summary of things", ["news"]), sk("b-summary", "summary of things", ["mail"])];
  assert.equal(scoreSkills("summary of my email inbox", two)[0].skill.name, "b-summary");
  assert.deepEqual(pickSkillsFor("check scope and headlines", all, { only: ["lab"] }).map((s) => s.name), ["scope-hygiene-check"]);
});

test("max and clip", () => {
  const r = pickSkillsFor("email", [sk("e1", "email", [], "x".repeat(3000)), sk("e2", "email"), sk("e3", "email")], { max: 2, clip: 100 });
  assert.equal(r.length, 2); assert.equal(r[0].body.length, 100);
});
