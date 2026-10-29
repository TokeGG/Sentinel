import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIdPrompt, connectLabel, firstError, statusText } from "./accountsLogic.ts";
import { getProvider } from "./providers.ts";

const row = (account: string, lastError: string | null = null) => ({ provider: "x", account, label: account, connectedAt: "", lastError });

test("status and labels", () => {
  assert.equal(statusText([]), "Not connected");
  assert.equal(statusText([row("a@b.c")]), "Connected as a@b.c");
  assert.equal(connectLabel(getProvider("github"), []), "Connect");
  assert.equal(connectLabel(getProvider("github"), [row("me")]), "Reconnect");
  assert.equal(connectLabel(getProvider("google-mail"), [row("me@x.com")]), "Add another");
  assert.equal(connectLabel(getProvider("google-mail"), [row("me@x.com", "expired")]), "Reconnect");
  assert.equal(firstError([row("a"), row("b", "boom")]), "boom");
});

test("client id prompt mentions the secret only where needed", () => {
  assert.match(clientIdPrompt("google", true), /secret/);
  assert.doesNotMatch(clientIdPrompt("twitch", false), /secret/);
});
