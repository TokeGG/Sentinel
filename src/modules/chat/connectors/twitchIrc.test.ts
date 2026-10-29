import { test } from "node:test";
import assert from "node:assert/strict";
import { clearTarget, parseBadges, parseEmotes, parseLine, toIncoming } from "./twitchIrc.ts";

const PRIV = "@badge-info=subscriber/8;badges=moderator/1,subscriber/6;color=#1E90FF;display-name=Some\\sOne;emotes=25:0-4,12-16/1902:6-10;id=abc;room-id=12345;tmi-sent-ts=1700000000000 :someone!someone@someone.tmi.twitch.tv PRIVMSG #chan :Kappa Keepo Kappa hi: there";

test("parseLine: tags, escapes, prefix, trailing", () => {
  const l = parseLine(PRIV + "\r\n")!;
  assert.equal(l.command, "PRIVMSG");
  assert.equal(l.nick, "someone");
  assert.deepEqual(l.params, ["#chan", "Kappa Keepo Kappa hi: there"]);
  assert.equal(l.tags["display-name"], "Some One");
  assert.equal(l.tags["room-id"], "12345");
});
test("parseLine: PING, no tags, garbage", () => {
  assert.deepEqual(parseLine("PING :tmi.twitch.tv"), { tags: {}, nick: "", command: "PING", params: ["tmi.twitch.tv"] });
  assert.equal(parseLine(""), null);
  assert.equal(parseLine("@a=b"), null);
});
test("tag escapes decode (\\: \\s \\\\)", () => {
  const l = parseLine("@k=a\\:b\\sc\\\\d :x PRIVMSG #c :hi")!;
  assert.equal(l.tags.k, "a;b c\\d");
});
test("PRIVMSG -> Incoming with badges, colour, emote ranges", () => {
  const m = toIncoming(parseLine(PRIV)!, "someone")!;
  assert.equal(m.user, "Some One");
  assert.equal(m.color, "#1E90FF");
  assert.deepEqual(m.badges, ["moderator", "subscriber"]);
  assert.equal(m.time, 1700000000000);
  assert.equal(m.self, true);
  assert.deepEqual(m.native!.map((e) => [e.name, e.start, e.end]), [["Kappa", 0, 4], ["Keepo", 6, 10], ["Kappa", 12, 16]]);
  assert.match(m.native![0].url, /emoticons\/v2\/25\//);
});
test("emote ranges are code points (astral chars before an emote)", () => {
  const e = parseEmotes("25:3-7", "😀😀 Kappa");
  assert.equal(e[0].name, "Kappa");
});
test("bad emote ranges are dropped", () => {
  assert.deepEqual(parseEmotes("25:5-99,x:1-2,9:4-2", "short"), []);
  assert.deepEqual(parseEmotes(undefined, "x"), []);
});
test("ACTION (/me) strips wrapper and shifts emote ranges", () => {
  const raw = "@emotes=25:8-12 :a!a@a PRIVMSG #c :\u0001ACTION Kappa\u0001";
  const m = toIncoming(parseLine(raw)!)!;
  assert.equal(m.kind, "action");
  assert.equal(m.text, "Kappa");
  assert.deepEqual([m.native![0].start, m.native![0].end, m.native![0].name], [0, 4, "Kappa"]);
});
test("USERNOTICE becomes a notice line", () => {
  const m = toIncoming(parseLine("@system-msg=x\\ssubscribed;display-name=x :tmi.twitch.tv USERNOTICE #c :nice")!)!;
  assert.equal(m.kind, "notice");
  assert.equal(m.text, "x subscribed — nice");
});
test("CLEARCHAT / non-chat commands", () => {
  assert.equal(clearTarget(parseLine(":tmi.twitch.tv CLEARCHAT #c :baduser")!), "baduser");
  assert.equal(clearTarget(parseLine(":tmi.twitch.tv CLEARCHAT #c")!), "");
  assert.equal(clearTarget(parseLine("PING :x")!), null);
  assert.equal(toIncoming(parseLine(":tmi.twitch.tv 001 justinfan1 :Welcome")!), null);
  assert.deepEqual(parseBadges("a/1,b/2"), ["a", "b"]);
  assert.deepEqual(parseBadges(""), []);
});
test("invalid colour tag ignored", () => {
  const m = toIncoming(parseLine("@color=red :a!a@a PRIVMSG #c :hi")!)!;
  assert.equal(m.color, undefined);
});
