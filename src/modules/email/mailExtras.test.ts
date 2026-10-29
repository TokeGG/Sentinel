import { test } from "node:test";
import assert from "node:assert/strict";
import { normSubject, threadMsgs, msgKey, type ThreadMeta } from "./threads.ts";
import { planRules, ruleMatches, type Rule } from "./rules.ts";
import { applySuggestion, contactPool, draftEmpty, isSnoozed, parseUnsubscribe, previewKind, snoozeChoices, suggest } from "./mailExtras.ts";
import type { Msg } from "./types.ts";

const msg = (uid: number, o: Partial<Msg> = {}): Msg => ({ accountId: "a", folder: "INBOX", uid, fromName: "Ann", fromAddr: "ann@x.com", to: "me@x.com", subject: "Hello", preview: "", dateTs: uid * 100, seen: false, starred: false, answered: false, hasAttach: false, ...o });

test("normSubject strips reply/forward prefixes", () => {
  assert.equal(normSubject("Re: FWD: re[2]:  Hello  World"), "hello world");
});

test("threads join by References/In-Reply-To and by Re: subject", () => {
  const ms = [msg(1, { subject: "Plan" }), msg(2, { subject: "Re: Plan" }), msg(3, { subject: "Other" }), msg(4, { subject: "Re: Plan" })];
  const meta = new Map<string, ThreadMeta>([
    [msgKey(ms[0]), { messageId: "<1@x>", inReplyTo: "", refs: "" }],
    [msgKey(ms[1]), { messageId: "<2@x>", inReplyTo: "<1@x>", refs: "<1@x>" }],
  ]);
  const t = threadMsgs(ms, meta);
  assert.equal(t.length, 2);
  assert.deepEqual(t[0].msgs.map((m) => m.uid), [1, 2, 4]);
  assert.equal(t[0].unread, 3);
  assert.equal(t[1].latest.uid, 3);
});

test("non-reply with same subject does not join", () => {
  assert.equal(threadMsgs([msg(1), msg(2)], new Map()).length, 2);
});

test("rules match and plan moves last, once", () => {
  const r = (id: number, o: Partial<Rule>): Rule => ({ id, field: "from", needle: "ann", action: "read", arg: "", enabled: true, ...o });
  const rules = [r(1, { action: "move", arg: "Ann" }), r(2, { action: "move", arg: "B" }), r(3, { field: "subject", needle: "hel", action: "flag" }), r(4, { enabled: false })];
  assert.ok(ruleMatches(rules[0], msg(1)));
  assert.ok(!ruleMatches(rules[3], msg(1)));
  const plan = planRules([msg(1), msg(2, { fromAddr: "bob@y", fromName: "Bob", subject: "x" })], rules);
  assert.deepEqual(plan.map((s) => [s.msg.uid, s.rule.id]), [[1, 3], [1, 1]]);
  assert.equal(planRules([msg(1, { starred: true, seen: true })], [r(5, {}), r(6, { action: "flag" })]).length, 0);
});

test("snooze choices are in the future and isSnoozed respects time", () => {
  const now = new Date(2026, 9, 29, 12);
  for (const c of snoozeChoices(now)) assert.ok(c.until > now.getTime() / 1000);
  assert.ok(isSnoozed(200, 100));
  assert.ok(!isSnoozed(100, 200));
  assert.ok(!isSnoozed(undefined, 1));
});

test("parseUnsubscribe finds https and mailto, ignores http", () => {
  const u = parseUnsubscribe("<http://bad/x>, <https://u.example/x?a=1>, <mailto:list@x.com?subject=stop>");
  assert.equal(u.https, "https://u.example/x?a=1");
  assert.deepEqual(u.mailto, { to: "list@x.com", subject: "stop", body: "unsubscribe" });
  assert.deepEqual(parseUnsubscribe(""), { https: null, mailto: null });
});

test("contacts autocomplete uses the last token", () => {
  const pool = contactPool([{ name: "Ann Lee", emails: "ann@x.com, a2@x.com" }], ["Bob <bob@y.com>", "ann@x.com"]);
  assert.deepEqual(suggest("carl@z.com, an", pool), ["Ann Lee <ann@x.com>", "Ann Lee <a2@x.com>"]);
  assert.deepEqual(suggest("bob", pool), ["Bob <bob@y.com>"]);
  assert.deepEqual(suggest("b", pool), []);
  assert.equal(applySuggestion("carl@z.com, bo", "Bob <bob@y.com>"), "carl@z.com, Bob <bob@y.com>, ");
});

test("previewKind allows images/pdf/text, never svg or html", () => {
  assert.equal(previewKind("image/png", "a.png"), "image");
  assert.equal(previewKind("image/svg+xml", "a.svg"), "none");
  assert.equal(previewKind("application/octet-stream", "x.pdf"), "pdf");
  assert.equal(previewKind("text/html", "a.html"), "none");
  assert.equal(previewKind("text/plain", "a"), "text");
});

test("draftEmpty", () => {
  assert.ok(draftEmpty({ to: " ", cc: "", bcc: "", subject: "", body: "\n" }));
  assert.ok(!draftEmpty({ to: "", cc: "", bcc: "", subject: "x", body: "" }));
});

import { VIRTUAL, visibleNow } from "./panelLogic.ts";
test("visibleNow hides future snoozes except in Snoozed", () => {
  const snooze = new Map([["a/INBOX/1", 500], ["a/INBOX/2", 50]]);
  assert.deepEqual(visibleNow([msg(1), msg(2), msg(3)], snooze, "INBOX", 100).map((m) => m.uid), [2, 3]);
  assert.equal(visibleNow([msg(1)], snooze, VIRTUAL.snoozed, 100).length, 1);
});
