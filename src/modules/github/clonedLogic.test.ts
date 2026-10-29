import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deletePreview, npmScripts, projectTypes, repoFromUrl, shortDate } from "./clonedLogic.ts";

describe("clonedLogic", () => {
  it("repoFromUrl", () => {
    assert.equal(repoFromUrl("https://github.com/o/r"), "o/r");
    assert.equal(repoFromUrl("https://github.com/o/r.git/"), "o/r");
    assert.equal(repoFromUrl("https://gitlab.com/o/r"), null);
    assert.equal(repoFromUrl("https://github.com/o/r/issues"), null);
    assert.equal(repoFromUrl(5), null);
  });
  it("npmScripts tolerates bad input", () => {
    assert.deepEqual(npmScripts('{"scripts":{"dev":"x","build":"y"}}'), ["dev", "build"]);
    assert.deepEqual(npmScripts("not json"), []);
    assert.deepEqual(npmScripts('{"scripts":[1]}'), []);
    assert.deepEqual(npmScripts(null), []);
    assert.equal(npmScripts(JSON.stringify({ scripts: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`s${i}`, "x"])) })).length, 12);
  });
  it("projectTypes", () => {
    assert.deepEqual(projectTypes({ markers: ["package.json"], package_json: '{"scripts":{"dev":"x"}}' }), ["Node, npm scripts: dev"]);
    assert.deepEqual(projectTypes({ markers: ["package.json"], package_json: null }), ["Node"]);
    assert.deepEqual(
      projectTypes({ markers: ["Cargo.toml", "a.sln", "Makefile", "pyproject.toml", "go.mod", "pom.xml"], package_json: null }),
      ["Rust", "Python", ".NET", "Go", "Java (Maven)", "Make"]
    );
    assert.deepEqual(projectTypes({ markers: [], package_json: null }), []);
  });
  it("deletePreview shows the exact path", () => {
    const t = deletePreview("C:\\Code\\my repo", { exists: true, markers: [], package_json: null, entries: 12 });
    assert.ok(t.includes("C:\\Code\\my repo") && t.includes("12+"));
    assert.ok(deletePreview("D:\\x", undefined).includes("D:\\x"));
  });
  it("shortDate", () => {
    assert.equal(shortDate("2026-10-29 12:00:00"), "2026-10-29");
    assert.equal(shortDate(null), "never");
  });
});
