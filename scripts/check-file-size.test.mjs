import test from "node:test";
import assert from "node:assert/strict";
import { countLines } from "./check-file-size.mjs";

const body = (n) => Array.from({ length: n }, () => "x").join("\n") + "\n";

test("ts files count all lines", () => assert.equal(countLines("a.ts", body(200)), 200));
test("test files are exempt", () => assert.equal(countLines("a.test.ts", body(500)), 0));
test("rs counts only lines before #[cfg(test)]", () =>
  assert.equal(countLines("a.rs", body(10) + "#[cfg(test)]\n" + body(300)), 10));
test("rs without cfg(test) counts all", () => assert.equal(countLines("a.rs", body(7)), 7));
