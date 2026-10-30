import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseScores, parseWeight, pickSkillsFor, rateSkill, scoreBoost, DEFAULT_BOOST_WEIGHT } from "./skillPick.ts";
import { cleanLang, taskMessages } from "./assist/assistTasks.ts";

const sk = (name: string, description: string) => ({ name, description, body: "", categories: [] });

describe("skill thumbs scores", () => {
  it("parse/rate/boost", () => {
    assert.deepEqual(parseScores("x"), {});
    assert.deepEqual(parseScores('{"a":{"up":2,"down":-1},"b":3}'), { a: { up: 2, down: 0 } });
    const s = rateSkill(rateSkill({}, "a", "up"), "a", "down");
    assert.deepEqual(s, { a: { up: 1, down: 1 } });
    assert.equal(scoreBoost(undefined), 0);
    assert.equal(scoreBoost({ up: 2, down: 0 }), 0.5);
    assert.equal(parseWeight(null), DEFAULT_BOOST_WEIGHT);
    assert.equal(parseWeight("99"), 6);
  });
  it("boost reorders fitting skills but never adds an unrelated one", () => {
    const skills = [sk("flight-search", "find flights"), sk("flight-deals", "find flights cheaply"), sk("weather", "forecast")];
    const base = pickSkillsFor("find flights", skills).map((s) => s.name);
    const scores = { [base[1]]: { up: 9, down: 0 }, [base[0]]: { up: 0, down: 9 }, weather: { up: 99, down: 0 } };
    const boosted = pickSkillsFor("find flights", skills, { scores }).map((s) => s.name);
    assert.deepEqual(boosted, [base[1], base[0]]);
    assert.ok(!boosted.includes("weather"));
  });
});

describe("assist tasks", () => {
  it("language and prompts", () => {
    assert.equal(cleanLang(""), "English");
    assert.equal(cleanLang("Deutsch<script>"), "Deutschscript");
    assert.equal(cleanLang("Español"), "Español");
    assert.match(taskMessages("summarize", "News", ["[r1] title=x"], "French")[1].content, /Summarize[\s\S]*French[\s\S]*\[r1\]/);
    const t = taskMessages("translate", "News", ["[r1] a"], "German", "Hello [r1]")[1].content;
    assert.match(t, /TEXT:\nHello \[r1\]/);
    assert.doesNotMatch(t, /PANEL ROWS/);
    assert.match(taskMessages("translate", "News", ["[r1] a"], "German")[1].content, /PANEL ROWS/);
  });
});
