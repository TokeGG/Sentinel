// Builds the Tauri updater manifest (latest.json) for a release.
// usage: node scripts/make-latest-json.mjs <tag> <installer.exe> <installer.exe.sig> <repo>
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export function makeLatest({ tag, exeName, signature, repo, notes = "", now = new Date() }) {
  if (!/^v\d+\.\d+\.\d+/.test(tag)) throw new Error(`tag must look like v0.1.1, got "${tag}"`);
  if (!signature.trim()) throw new Error("empty signature");
  return {
    version: tag.slice(1),
    notes,
    pub_date: now.toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: signature.trim(),
        url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(exeName)}`,
      },
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [tag, exe, sig, repo] = process.argv.slice(2);
  const json = makeLatest({ tag, exeName: basename(exe), signature: readFileSync(sig, "utf8"), repo });
  writeFileSync("latest.json", JSON.stringify(json, null, 2) + "\n");
}
