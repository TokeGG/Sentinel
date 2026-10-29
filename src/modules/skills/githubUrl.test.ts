import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertAllowedUrl, parseSource } from "./githubUrl.ts";
import { cleanRel, slugId } from "./paths.ts";

const src = (s: string) => {
  const r = parseSource(s);
  assert.ok(r.ok, s + " -> " + JSON.stringify(r));
  return r.source;
};

describe("parseSource", () => {
  it("accepts repo URLs, shorthand, ref and subdir forms", () => {
    assert.deepEqual(src("https://github.com/acme/tools"), { owner: "acme", repo: "tools", ref: "", subdir: "" });
    assert.deepEqual(src(" https://github.com/acme/tools.git/ "), { owner: "acme", repo: "tools", ref: "", subdir: "" });
    assert.deepEqual(src("https://github.com/acme/tools/tree/v1.2/skills/pdf"), { owner: "acme", repo: "tools", ref: "v1.2", subdir: "skills/pdf" });
    assert.deepEqual(src("acme/tools"), { owner: "acme", repo: "tools", ref: "", subdir: "" });
    assert.deepEqual(src("acme/tools@feat/x:skills/a"), { owner: "acme", repo: "tools", ref: "feat/x", subdir: "skills/a" });
  });
  it("rejects other hosts, schemes, traversal and junk", () => {
    for (const bad of ["", "   ", "http://github.com/a/b", "ftp://github.com/a/b", "https://gitlab.com/a/b", "https://github.com.evil.io/a/b",
      "https://user:pw@github.com/a/b", "https://github.com:444/a/b", "https://github.com/a", "https://github.com/a/b/issues/3",
      "a/b:../x", "a/b:/etc", "a/b@..", "a/b@x..y", "-a/b", "a/..", "a b/c", "git@github.com:a/b.git", "https://github.com/a/b/tree/main/../../x"])
      assert.equal(parseSource(bad).ok, false, bad);
  });
});

describe("allow-list and paths", () => {
  it("assertAllowedUrl lets only https github hosts through", () => {
    for (const ok of ["https://api.github.com/repos/a/b", "https://raw.githubusercontent.com/a/b/sha/x", "https://github.com/a/b"]) assert.ok(assertAllowedUrl(ok));
    for (const bad of ["http://api.github.com/x", "https://evil.com/x", "https://api.github.com.evil.com/", "https://api.github.com:8443/x", "https://u@api.github.com/", "nonsense", "file:///etc/passwd"])
      assert.throws(() => assertAllowedUrl(bad), /blocked|not a URL/, bad);
  });
  it("cleanRel refuses anything that could leave the install dir", () => {
    assert.equal(cleanRel("a/b/SKILL.md"), "a/b/SKILL.md");
    for (const bad of ["", "/x", "../x", "a/../b", "a//b", "a\\b", "C:/x", "a/./b", "nul.txt", "x.", "a\u0000b", 5, null])
      assert.equal(cleanRel(bad), null, String(bad));
  });
  it("slugId builds a directory-safe id", () => {
    assert.equal(slugId("Acme", "Tools", "skills/PDF"), "acme-tools-skills-pdf");
    assert.match(slugId("a", "b", "x y/z!"), /^[a-z0-9._-]+$/);
    assert.ok(slugId("a".repeat(40), "b".repeat(100), "").length <= 64);
  });
});
