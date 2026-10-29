import { test } from "node:test";
import assert from "node:assert/strict";
import { detectRoom, parseDgg, parseEmbed, parseKick, parseTwitch, parseYoutube, youtubeChatUrls } from "./rooms.ts";

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
test("youtube: watch, youtu.be, live, live_chat urls and bare id", () => {
  for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube.com/watch?feature=x&v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=5",
    "https://www.youtube.com/live/dQw4w9WgXcQ", "https://m.youtube.com/live_chat?v=dQw4w9WgXcQ&is_popout=1", "dQw4w9WgXcQ"])
    assert.deepEqual(parseYoutube(u), { site: "youtube", target: "dQw4w9WgXcQ", label: "youtube dQw4w9WgXcQ" }, u);
  for (const bad of ["https://www.youtube.com/@chan", "https://www.youtube.com/watch?v=short", "https://www.youtube.com/watch", "http://youtu.be/dQw4w9WgXcQ",
    "https://evil.com/watch?v=dQw4w9WgXcQ", "https://notyoutube.com/live/dQw4w9WgXcQ", "https://youtu.be/", "xqc"])
    assert.equal(parseYoutube(bad), null, bad);
});
test("youtube chat urls: embed_domain is the host, popout is top-level", () => {
  const u = youtubeChatUrls("dQw4w9WgXcQ", "tauri.localhost");
  assert.equal(u.frame, "https://www.youtube.com/live_chat?v=dQw4w9WgXcQ&embed_domain=tauri.localhost");
  assert.equal(u.panel, "https://www.youtube.com/live_chat?is_popout=1&v=dQw4w9WgXcQ");
});
test("detectRoom routes youtube urls before the embed catch-all", () => {
  assert.equal(detectRoom("https://youtu.be/dQw4w9WgXcQ")?.site, "youtube");
  assert.equal(detectRoom("https://www.youtube.com/@chan")?.site, "embed");
  assert.equal(detectRoom("dQw4w9WgXcQ"), null);
  assert.equal(detectRoom("dQw4w9WgXcQ", "youtube")?.target, "dQw4w9WgXcQ");
});
