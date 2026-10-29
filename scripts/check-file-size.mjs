// File-size guard: no .ts/.tsx/.rs file over MAX lines.
// Exempt: *.test.ts; for .rs, lines from the first `#[cfg(test)]` on.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX = 150;

// Files still over the limit today; each is scheduled for its own split.
// Remove an entry when its file is split. Do NOT add new ones.
const ALLOW = [
  "src/modules/finance/index.ts", // scheduled for its own split (finance)
];

export function countLines(path, text) {
  if (path.endsWith(".test.ts")) return 0;
  let lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (path.endsWith(".rs")) {
    const i = lines.findIndex((l) => l.trim().startsWith("#[cfg(test)]"));
    if (i >= 0) lines = lines.slice(0, i);
  }
  return lines.length;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|rs)$/.test(name)) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  const bad = [];
  for (const d of ["src", "src-tauri/src"])
    for (const f of walk(join(root, d))) {
      const rel = relative(root, f).split("\\").join("/");
      const n = countLines(rel, readFileSync(f, "utf8"));
      if (n > MAX && !ALLOW.includes(rel)) bad.push(`${rel}: ${n} lines`);
    }
  if (bad.length) {
    console.error(`Files over ${MAX} lines:\n` + bad.join("\n"));
    process.exit(1);
  }
  console.log(`check-file-size: ok (limit ${MAX})`);
}
