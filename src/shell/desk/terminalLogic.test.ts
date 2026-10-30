import test from "node:test";
import assert from "node:assert/strict";
import { countBoxes, findModule, parseCommand } from "./terminalLogic.ts";

const mods = [{ id: "hub.news", name: "News" }, { id: "hub.email", name: "Mail" }, { id: "hub.pentest", name: "Pentest Lab" }, { id: "hub.notes", name: "Notes" }];

test("findModule by id tail, name, unique prefix", () => {
  assert.equal(findModule("news", mods)?.id, "hub.news");
  assert.equal(findModule("MAIL", mods)?.id, "hub.email");
  assert.equal(findModule("pentestlab", mods)?.id, "hub.pentest");
  assert.equal(findModule("pen", mods)?.id, "hub.pentest");
  assert.equal(findModule("n", mods), null); // ambiguous
});

test("parseCommand", () => {
  assert.deepEqual(parseCommand("open news", mods), { kind: "open", id: "hub.news" });
  assert.deepEqual(parseCommand("mail", mods), { kind: "open", id: "hub.email" });
  assert.deepEqual(parseCommand("home", mods), { kind: "home" });
  assert.deepEqual(parseCommand("?", mods), { kind: "help" });
  assert.deepEqual(parseCommand("zap", mods), { kind: "unknown", text: "zap" });
});

test("countBoxes keeps non-zero, biggest first", () => {
  assert.deepEqual(countBoxes({ "hub.news": 3, "hub.email": 12, "hub.notes": 0 }, mods).map((b) => b.n), [12, 3]);
});

import { complete, expandAlias, histStep } from "./terminalLogic.ts";
import { clockLines, parseAliases, sanitizeTerm } from "./termPrefs.ts";

test("note/todo/timer/clip commands", () => {
  assert.deepEqual(parseCommand("note buy milk", mods), { kind: "note", text: "buy milk" });
  assert.deepEqual(parseCommand("todo call mom", mods), { kind: "todo", text: "call mom" });
  assert.deepEqual(parseCommand("timer 25 focus", mods), { kind: "timer", minutes: 25, label: "focus" });
  assert.equal(parseCommand("timer 0", mods).kind, "unknown");
  assert.equal(parseCommand("clip", mods).kind, "clip");
});

test("aliases, completion, history", () => {
  assert.equal(expandAlias("m now", { m: "open mail" }), "open mail now");
  assert.equal(complete("ne", mods), "news ");
  assert.equal(complete("open pen", mods), "open pentest ");
  assert.equal(complete("no", mods), "note"); // note + notes: common prefix
  assert.equal(histStep(["a", "b"], 2, -1), 1);
  assert.equal(histStep(["a", "b"], 2, 1), 2);
});

test("term prefs sanitize", () => {
  const p = sanitizeTerm({ prompt: "  me $ ", aliases: { "M": "open mail", "bad key": "x" }, hidden: ["feed", "nope"], clocks: ["Asia/Tokyo", "Mars/Base"], order: ["apps"] });
  assert.equal(p.prompt, "me $");
  assert.deepEqual(p.aliases, { m: "open mail" });
  assert.deepEqual(p.hidden, ["feed"]);
  assert.deepEqual(p.clocks, ["Asia/Tokyo"]);
  assert.equal(p.order[0], "apps");
  assert.deepEqual(parseAliases("y=open youtube, q=search"), { y: "open youtube", q: "search" });
  assert.match(clockLines(new Date(Date.UTC(2026, 0, 1, 12)), ["Asia/Tokyo"], "24h", "UTC")[1], /^tokyo 21:00$/);
});
