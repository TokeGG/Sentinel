import { test } from "node:test";
import assert from "node:assert/strict";
import { hostOfAccount, mastodonAccount, normalizeInstance, registrationSig } from "./mastodonLogic.ts";

test("normalizeInstance accepts hosts and URLs, rejects junk", () => {
  assert.equal(normalizeInstance("https://Mastodon.Social/@me"), "mastodon.social");
  assert.equal(normalizeInstance(" fosstodon.org "), "fosstodon.org");
  assert.equal(normalizeInstance("@me@hachyderm.io"), "hachyderm.io");
  for (const bad of ["", "localhost", "a b.com", "http://", "evil.com:80@x", "1.2.3"]) assert.equal(normalizeInstance(bad), null, bad);
});

test("account keys", () => {
  assert.equal(mastodonAccount("me", "a.social"), "me@a.social");
  assert.equal(mastodonAccount("me@b.social", "a.social"), "me@b.social");
  assert.equal(hostOfAccount("me@a.social"), "a.social");
});

test("registration signature changes with scopes", () => {
  assert.notEqual(registrationSig("r", ["read"]), registrationSig("r", ["read", "write"]));
});
