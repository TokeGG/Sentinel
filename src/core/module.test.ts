import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateManifest, ManifestError, ringOf, type ModuleManifest } from "./module.ts";
import { RINGS } from "./customizeChecks.ts";

function base(overrides: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id: "hub.test",
    name: "Test",
    description: "A test module",
    panel: "custom",
    ui: async () => ({ default: () => null }),
    skills: [],
    ...overrides,
  };
}

describe("validateManifest", () => {
  it("accepts a well-formed manifest", () => {
    assert.doesNotThrow(() => validateManifest(base(), []));
  });

  it("rejects a non-reverse-DNS id", () => {
    assert.throws(() => validateManifest(base({ id: "notes" }), []), ManifestError);
  });

  it("rejects a duplicate id", () => {
    const existing = [base()];
    assert.throws(() => validateManifest(base(), existing), ManifestError);
  });

  it("rejects an unknown panel kind", () => {
    assert.throws(
      () => validateManifest(base({ panel: "map" as never }), []),
      ManifestError
    );
  });

  it("rejects duplicate skill names", () => {
    const run = async () => ({});
    assert.throws(
      () =>
        validateManifest(
          base({ skills: [{ name: "x", run }, { name: "x", run }] }),
          []
        ),
      ManifestError
    );
  });

  it("requires load() for a list/table panel", () => {
    assert.throws(
      () => validateManifest(base({ panel: "list" }), []),
      ManifestError
    );
  });

  it("allows a list panel with load()", () => {
    assert.doesNotThrow(() =>
      validateManifest(base({ panel: "list", load: async () => [] }), [])
    );
  });

  it("rejects an action referencing an unknown skill", () => {
    assert.throws(
      () => validateManifest(base({ actions: [{ label: "Go", skill: "nope" }] }), []),
      ManifestError
    );
  });

  it("rejects a quickAdd referencing an unknown skill", () => {
    assert.throws(
      () =>
        validateManifest(
          base({ quickAdd: { skill: "nope", argName: "x", placeholder: "…" } }),
          []
        ),
      ManifestError
    );
  });

  it("rejects a rowAction referencing an unknown skill", () => {
    assert.throws(
      () =>
        validateManifest(
          base({
            rowAction: { label: "Open", skill: "nope", argName: "x", fromField: "link" },
          }),
          []
        ),
      ManifestError
    );
  });

  it("rejects a credentialField with no key", () => {
    assert.throws(
      () => validateManifest(base({ credentialFields: [{ key: "", label: "Token" }] }), []),
      ManifestError
    );
  });

  it("rejects duplicate credentialField keys", () => {
    assert.throws(
      () =>
        validateManifest(
          base({
            credentialFields: [
              { key: "token", label: "A" },
              { key: "token", label: "B" },
            ],
          }),
          []
        ),
      ManifestError
    );
  });

  it("rejects a schedule referencing an unknown skill", () => {
    assert.throws(
      () =>
        validateManifest(base({ schedule: { skill: "nope", intervalMinutes: 5 } }), []),
      ManifestError
    );
  });

  it("rejects a schedule with intervalMinutes below 1", () => {
    const run = async () => ({});
    assert.throws(
      () =>
        validateManifest(
          base({ skills: [{ name: "go", run }], schedule: { skill: "go", intervalMinutes: 0 } }),
          []
        ),
      ManifestError
    );
  });

  it("accepts a valid schedule referencing a real skill", () => {
    const run = async () => ({});
    assert.doesNotThrow(() =>
      validateManifest(
        base({ skills: [{ name: "go", run }], schedule: { skill: "go", intervalMinutes: 30 } }),
        []
      )
    );
  });

  it("rejects a form referencing an unknown skill", () => {
    assert.throws(
      () =>
        validateManifest(
          base({ forms: [{ skill: "nope", label: "Compose", fields: [{ key: "x", label: "X" }] }] }),
          []
        ),
      ManifestError
    );
  });

  it("rejects a form with no fields", () => {
    const run = async () => ({});
    assert.throws(
      () =>
        validateManifest(
          base({ skills: [{ name: "go", run }], forms: [{ skill: "go", label: "Compose", fields: [] }] }),
          []
        ),
      ManifestError
    );
  });

  it("accepts a valid form referencing a real skill", () => {
    const run = async () => ({});
    assert.doesNotThrow(() =>
      validateManifest(
        base({
          skills: [{ name: "go", run }],
          forms: [{ skill: "go", label: "Compose", fields: [{ key: "x", label: "X" }] }],
        }),
        []
      )
    );
  });

  describe("customize / ui / badge", () => {
    const opt = { key: "k", label: "K", type: "toggle" as const, default: true };
    const num = { key: "n", label: "N", type: "number" as const, default: 3, min: 1, max: 5 };
    const sel = { key: "s", label: "S", type: "select" as const, default: "x", choices: ["x", "y"] };
    const bad = (m: unknown, re: RegExp) =>
      assert.throws(() => validateManifest(base(m as Partial<ModuleManifest>), []), (e) => {
        assert.ok(e instanceof ManifestError, `expected ManifestError, got ${e}`);
        assert.match((e as Error).message, re);
        return true;
      });
    const opts = (...options: unknown[]) => ({ customize: { options } });
    it("custom panel without ui is rejected", () => bad({ ui: undefined }, /needs a ui/));
    it("duplicate section ids rejected", () =>
      bad({ customize: { sections: [{ id: "a", label: "A" }, { id: "a", label: "B" }] } }, /duplicate customize section/));
    it("duplicate option keys rejected", () => bad(opts(opt, opt), /duplicate customize option/));
    it("empty section id / option key rejected", () => {
      bad({ customize: { sections: [{ id: " ", label: "A" }] } }, /section needs an id/);
      bad(opts({ ...opt, key: "" }), /option needs a key/);
    });
    it("select option without choices rejected", () => {
      bad(opts({ ...sel, choices: undefined }), /needs choices/);
      bad(opts({ ...sel, choices: [] }), /needs choices/);
    });
    it("select default not in choices rejected", () =>
      bad(opts({ ...sel, default: "z" }), /one of its choices/));
    it("choices must be unique non-empty strings, select only", () => {
      bad(opts({ ...sel, choices: ["x", "x"] }), /choices must be unique non-empty strings/);
      bad(opts({ ...sel, choices: ["x", ""] }), /choices must be unique non-empty strings/);
      bad(opts({ ...sel, choices: ["x", 1] }), /choices must be unique non-empty strings/);
      bad(opts({ ...opt, choices: ["a"] }), /choices only valid on select/);
    });
    it("number option with min > max rejected", () => bad(opts({ ...num, min: 5, max: 2 }), /min.*max/));
    it("number min/max/default must be finite numbers", () => {
      bad(opts({ ...num, default: NaN }), /default must be a finite number/);
      bad(opts({ ...num, default: Infinity }), /default must be a finite number/);
      bad(opts({ ...num, min: NaN }), /min must be a finite number/);
      bad(opts({ ...num, max: "9" }), /max must be a finite number/);
    });
    it("number default outside [min,max] rejected", () => {
      bad(opts({ ...num, default: 0 }), /default.*within min.*max/);
      bad(opts({ ...num, default: 6 }), /default.*within min.*max/);
    });
    it("option default of the wrong type rejected", () => {
      bad(opts({ ...opt, default: "x" }), /default must be a boolean/);
      bad(opts({ ...sel, default: 1 }), /default must be a string/);
    });
    it("unknown option type rejected", () => bad(opts({ ...opt, type: "slider" }), /type must be/));
    it("section default must be boolean", () =>
      bad({ customize: { sections: [{ id: "a", label: "A", default: "yes" }] } }, /section "a" default must be a boolean/));
    it("malformed shapes throw ManifestError, not TypeError", () => {
      bad({ customize: "x" }, /customize must be an object/);
      bad({ customize: null }, /customize must be an object/);
      bad({ customize: { sections: "x" } }, /sections must be an array/);
      bad({ customize: { options: {} } }, /options must be an array/);
      bad({ customize: { sections: [null] } }, /section must be an object/);
      bad({ customize: { options: [null] } }, /option must be an object/);
      bad({ customize: { options: ["x"] } }, /option must be an object/);
    });
    it("valid customize accepted", () => {
      assert.doesNotThrow(() =>
        validateManifest(
          base({
            customize: {
              sections: [{ id: "a", label: "A", default: false }, { id: "b", label: "B" }],
              options: [opt, sel, num],
            },
            badge: async () => 3,
          }),
          []
        )
      );
    });
    it("ui and badge may be omitted on list panels", () => {
      assert.doesNotThrow(() =>
        validateManifest(base({ panel: "list", ui: undefined, load: async () => [] }), [])
      );
    });
  });

  describe("web panel", () => {
    const web = { url: "https://discord.com/app", profile: "discord" };
    it("rejects web panel without web config", () => {
      assert.throws(() => validateManifest(base({ panel: "web" }), []), /web/);
    });
    it("rejects web config on non-web panel", () => {
      assert.throws(() => validateManifest(base({ web }), []), /web/);
    });
    it("rejects web url that is not https", () => {
      assert.throws(
        () => validateManifest(base({ panel: "web", web: { ...web, url: "http://x.com" } }), []),
        /https/
      );
    });
    it("rejects web url without host or with credentials", () => {
      for (const url of ["https://", "https://user:pw@example.com"]) {
        assert.throws(
          () => validateManifest(base({ panel: "web", web: { ...web, url } }), []),
          /https/
        );
      }
    });
    it("rejects profile with path characters", () => {
      for (const profile of ["../x", "a b", "a/b"]) {
        assert.throws(
          () => validateManifest(base({ panel: "web", web: { ...web, profile } }), []),
          ManifestError
        );
      }
    });
    it("accepts a valid web manifest", () => {
      for (const profile of ["discord", "yt-main"]) {
        assert.doesNotThrow(() =>
          validateManifest(base({ panel: "web", web: { ...web, profile } }), [])
        );
      }
    });
  });
});

describe("accent", () => {
  const bad = (accent: unknown) =>
    assert.throws(() => validateManifest(base({ accent } as Partial<ModuleManifest>), []), (e) => {
      assert.ok(e instanceof ManifestError);
      assert.match((e as Error).message, /accent/);
      return true;
    });
  it("accepts #rrggbb and absent", () => {
    assert.doesNotThrow(() => validateManifest(base({ accent: "#FFb454" }), []));
    assert.doesNotThrow(() => validateManifest(base(), []));
  });
  it("rejects named, short, css-function and non-string values", () => {
    for (const v of ["red", "#fff", "url(x)", "#gggggg", 5, null]) bad(v);
  });
});

describe("ring / icon", () => {
  const bad = (o: Record<string, unknown>, re: RegExp) =>
    assert.throws(() => validateManifest(base(o as Partial<ModuleManifest>), []), (e) => {
      assert.ok(e instanceof ManifestError);
      assert.match((e as Error).message, re);
      return true;
    });
  it("accepts every ring, a known icon, and both absent", () => {
    for (const ring of RINGS) assert.doesNotThrow(() => validateManifest(base({ ring }), []));
    assert.doesNotThrow(() => validateManifest(base({ icon: "notes" }), []));
    assert.doesNotThrow(() => validateManifest(base(), []));
  });
  it("invalid ring is rejected", () => {
    for (const ring of ["inner", "Daily", "", 3, null]) bad({ ring }, /ring/);
  });
  it("unknown icon key is rejected by validateManifest", () => {
    for (const icon of ["nope", "", "constructor", "toString", 5, null]) bad({ icon }, /icon/);
  });
  it("ring defaults to system; icon has no default", () => {
    assert.equal(ringOf(base()), "system");
    assert.equal(ringOf(base({ ring: "media" })), "media");
    assert.equal(base().icon, undefined);
  });
});
