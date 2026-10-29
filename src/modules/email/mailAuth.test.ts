import { test } from "node:test";
import assert from "node:assert/strict";
import { authOf, baseForProvider, oauthPreset } from "./mailAuth.ts";
import { draftFromPreset, presetById, validateDraft } from "./presets.ts";

test("authOf splits OAuth presets; password presets have no provider", () => {
  assert.deepEqual(authOf("gmail:oauth"), { base: "gmail", provider: "google-mail" });
  assert.deepEqual(authOf("outlook:oauth"), { base: "outlook", provider: "microsoft-mail" });
  assert.deepEqual(authOf("gmail"), { base: "gmail", provider: null });
  assert.equal(authOf("icloud:oauth").provider, null);
  assert.throws(() => oauthPreset("icloud"));
  assert.equal(baseForProvider("google-mail"), "gmail");
});
test("OAuth drafts validate without a password and keep the preset hosts", () => {
  const d = { ...draftFromPreset("gmail", "a@b.co"), preset: oauthPreset("gmail") };
  assert.deepEqual(validateDraft(d), []);
  assert.equal(presetById(d.preset).imapHost, "imap.gmail.com");
  assert.ok(validateDraft(draftFromPreset("gmail", "a@b.co")).some((e) => /Password/.test(e)));
});
