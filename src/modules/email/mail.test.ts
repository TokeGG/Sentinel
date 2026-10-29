import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkRecipients, formatAddr, isEmail, parseAddressList } from "./addresses.ts";
import { PRESETS, draftFromPreset, presetById, savesSentCopy, validateDraft } from "./presets.ts";
import { decodeFolderName, folderLabel, folderOfRole, folderRole, sortFolders } from "./folders.ts";
import { buildDraft, quoteText } from "./composeLogic.ts";
import { dateLabel, emailSections, previewLine, searchMessages, sortMessages, staleUids, urlsIn } from "./panelLogic.ts";
import type { Body, Msg } from "./types.ts";

const msg = (o: Partial<Msg> = {}): Msg => ({ accountId: "a", folder: "INBOX", uid: 1, fromName: "Ann", fromAddr: "ann@x.com", to: "me@x.com", subject: "Hello", preview: "pv", dateTs: 1700000000, seen: false, starred: false, answered: false, hasAttach: false, ...o });
const body = (o: Partial<Body> = {}): Body => ({ text: "line1\n\nline3", html: null, from: [], to: [{ name: "", address: "me@x.com" }, { name: "Bob", address: "bob@x.com" }], cc: [{ name: "", address: "BOB@x.com" }, { name: "", address: "cy@x.com" }], replyTo: [], messageId: "id1@x", attachments: [], ...o });

test("address parsing handles names, quotes, separators and invalid entries", () => {
  const r = parseAddressList('Ann <a@x.com>, b@x.com; "Lee, Bo" <l@x.com>, nope, <bad@>');
  assert.deepEqual(r.ok.map((a) => a.address), ["a@x.com", "b@x.com", "l@x.com"]);
  assert.equal(r.ok[2].name, "Lee, Bo");
  assert.deepEqual(r.bad, ["nope", "<bad@>"]);
  assert.equal(formatAddr(r.ok[2]), '"Lee, Bo" <l@x.com>');
  assert.equal(formatAddr({ name: 'E"v\r\nil', address: "e@x.com" }), "Evil <e@x.com>");
  assert.ok(isEmail("a@b.co") && !isEmail("a@b") && !isEmail("a b@c.com"));
});
test("recipients need at least one valid address", () => {
  assert.match(checkRecipients("", "", "").errors[0], /recipient/);
  assert.equal(checkRecipients("a@x.com", "", "b@x.com").errors.length, 0);
  assert.equal(checkRecipients("a@x.com", "zzz", "").errors.length, 1);
});
test("presets: hosts, app-password notes, validation", () => {
  assert.equal(presetById("gmail").imapHost, "imap.gmail.com");
  assert.equal(presetById("unknown").id, "custom");
  assert.match(presetById("gmail").note, /app password/i);
  assert.match(presetById("icloud").note, /app-specific password/i);
  assert.ok(PRESETS.every((p) => p.imapPort > 0 && p.note));
  assert.ok(savesSentCopy("gmail") && !savesSentCopy("icloud"));
  const d = { ...draftFromPreset("gmail", "me@gmail.com"), password: "pw" };
  assert.deepEqual(validateDraft(d), []);
  assert.ok(validateDraft({ ...d, password: "" }).length === 1);
  assert.ok(validateDraft({ ...d, imapPort: 0, smtpHost: "bad host" }).length === 2);
});
test("folder roles from attributes then names; ordering and labels", () => {
  assert.equal(folderRole("Weird", ["\\Sent"]), "sent");
  assert.equal(folderRole("INBOX"), "inbox");
  assert.equal(folderRole("Deleted Items"), "trash");
  assert.equal(folderRole("[Gmail]/Drafts"), "drafts");
  assert.equal(folderRole("Projects"), "other");
  const fs = sortFolders([{ name: "Zed", role: "other" }, { name: "Trash", role: "trash" }, { name: "INBOX", role: "inbox" }]);
  assert.deepEqual(fs.map((f) => f.name), ["INBOX", "Trash", "Zed"]);
  assert.equal(folderOfRole(fs, "trash"), "Trash");
  assert.equal(folderOfRole(fs, "sent"), null);
  assert.equal(decodeFolderName("Entw&APw-rfe"), "Entwürfe");
  assert.equal(decodeFolderName("A&-B"), "A&B");
  assert.equal(folderLabel({ name: "INBOX/Sub", role: "other" }), "Sub");
});
test("reply quoting, subject prefixes, In-Reply-To", () => {
  assert.equal(quoteText("a\n\nb"), "> a\n>\n> b");
  const d = buildDraft("reply", msg({ subject: "Re: Hello" }), body(), "me@x.com");
  assert.equal(d.subject, "Re: Hello");
  assert.equal(d.to, "Ann <ann@x.com>");
  assert.equal(d.inReplyTo, "<id1@x>");
  assert.match(d.body, /Ann <ann@x.com> wrote:\n> line1\n>\n> line3/);
  assert.equal(buildDraft("reply", msg(), body({ replyTo: [{ name: "", address: "rt@x.com" }] }), "me@x.com").to, "rt@x.com");
});
test("reply all adds others once, minus me and the sender", () => {
  const d = buildDraft("replyAll", msg(), body(), "ME@x.com");
  assert.equal(d.cc, "Bob <bob@x.com>, cy@x.com");
});
test("forward keeps original headers and has no recipients", () => {
  const d = buildDraft("forward", msg(), body(), "me@x.com");
  assert.equal(d.subject, "Fwd: Hello");
  assert.equal(d.to, "");
  assert.match(d.body, /Forwarded message[\s\S]*From: Ann <ann@x.com>[\s\S]*line1/);
  assert.equal(buildDraft("forward", msg({ subject: "Fw: x" }), null, "me@x.com").subject, "Fw: x");
});
test("sorting is newest first with UID tiebreak; search over from/subject/preview", () => {
  const ms = [msg({ uid: 1, dateTs: 5 }), msg({ uid: 3, dateTs: 5 }), msg({ uid: 2, dateTs: 9, subject: "Invoice", preview: "pay now" })];
  assert.deepEqual(sortMessages(ms).map((m) => m.uid), [2, 3, 1]);
  assert.deepEqual(searchMessages(ms, "invoice PAY").map((m) => m.uid), [2]);
  assert.deepEqual(searchMessages(ms, "ann@x").length, 3);
  assert.equal(searchMessages(ms, "  ").length, 3);
});
test("labels and stale detection", () => {
  assert.equal(previewLine("a  b\n c", 100), "a b c");
  assert.equal(previewLine("x".repeat(20), 10).length, 10);
  const now = new Date("2024-06-15T12:00:00");
  assert.equal(dateLabel(0, now), "");
  assert.equal(dateLabel(new Date("2024-03-03T10:00:00").getTime() / 1000, now), "Mar 3");
  assert.equal(dateLabel(new Date("2022-03-03T10:00:00").getTime() / 1000, now), "Mar 3, 2022");
  assert.deepEqual(staleUids([1, 5, 8, 9, 10], [10, 9, 7, 5]), [8]);
  assert.deepEqual(staleUids([1, 2], []), []);
});
test("urlsIn finds http(s) links only", () => {
  assert.deepEqual(urlsIn("see https://a.com/x, and http://b.org). javascript:alert(1) https://a.com/x").map((l) => l.url), ["https://a.com/x", "http://b.org"]);
});
test("manifest section ids match Panel.tsx <Section id>", () => {
  const src = readFileSync(new URL("./Panel.tsx", import.meta.url), "utf8");
  const used = [...src.matchAll(/<Section id="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(used, emailSections.map((s) => s.id).sort());
});
