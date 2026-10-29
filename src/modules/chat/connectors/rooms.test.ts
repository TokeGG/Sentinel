import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRoom, parseDgg, parseEmbed, parseKick, parseTwitch } from "./rooms.ts";

test("twitch: bare, url, popout, reserved", () => {
  assert.equal(parseTwitch("XQC")?.target, "xqc");
  assert.equal(parseTwitch("#xqc")?.target, "xqc");
  assert.equal(parseTwitch("https://www.twitch.tv/xqc")?.target, "xqc");
  assert.equal(parseTwitch("twitch.tv/popout/Shroud/chat")?.target, "shroud");
  assert.equal(parseTwitch("https://www.twitch.tv/directory"), null);
  assert.equal(parseTwitch("https://kick.com/xqc"), null);
  assert.equal(parseTwitch("a b"), null);
});
test("kick: bare and url", () => {
  assert.equal(parseKick("https://kick.com/Trainwreckstv")?.target, "trainwreckstv");
  assert.equal(parseKick("kick.com/popout/foo-bar/chat")?.target, "foo-bar");
  assert.equal(parseKick("https://twitch.tv/x"), null);
  assert.equal(parseKick("https://kick.com/video/abc"), null);
});
test("dgg", () => {
  for (const ok of ["destiny.gg", "https://www.destiny.gg/embed/chat", "d.gg", "dgg", "https://chat.destiny.gg/"]) assert.equal(parseDgg(ok)?.site, "dgg", ok);
  assert.equal(parseDgg("someone"), null);
});
test("embed: https urls only, never a bare word", () => {
  assert.equal(parseEmbed("https://www.icanhazchat.com/room")?.label, "icanhazchat.com/room");
  assert.equal(parseEmbed("http://insecure.example/chat"), null);
  assert.equal(parseEmbed("javascript:alert(1)"), null);
  assert.equal(parseEmbed("xqc"), null);
  assert.equal(parseEmbed("https://user:pw@host.com/x"), null);
});
test("detectRoom auto: urls route to their site, bare names need a site", () => {
  assert.equal(detectRoom("https://twitch.tv/xqc")?.site, "twitch");
  assert.equal(detectRoom("kick.com/xqc")?.site, "kick");
  assert.equal(detectRoom("destiny.gg")?.site, "dgg");
  assert.equal(detectRoom("https://www.twitch.tv/popout/xqc/chat")?.site, "twitch");
  assert.equal(detectRoom("https://rumble.com/chat/popup/123")?.site, "embed");
  assert.equal(detectRoom("xqc"), null);
  assert.equal(detectRoom("xqc", "kick")?.site, "kick");
  assert.equal(detectRoom("https://twitch.tv/xqc", "embed")?.site, "embed");
  assert.equal(detectRoom("x", "nope"), null);
});
