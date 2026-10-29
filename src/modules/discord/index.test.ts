import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../../core/module.ts";
import { ICONS } from "../../shell/icons.ts";
import { discordModule } from "./index.ts";

describe("discord manifest", () => {
  it("is a valid web panel with a known icon and the expected profile", () => {
    assert.doesNotThrow(() => validateManifest(discordModule, []));
    assert.equal(discordModule.web?.profile, "discord");
    assert.ok(discordModule.icon && discordModule.icon in ICONS);
  });
  it("allow-list never contains the app origin", () => {
    assert.ok(!discordModule.web?.hosts?.some((h) => h.includes("localhost")));
  });
});
