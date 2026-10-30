// On-demand Pwned Passwords check (button only), reusing the k-anonymity helpers in netcheck.ts.
import { fetch } from "@tauri-apps/plugin-http";
import { PWNED_URL, pwnedCount, sha1Hex, splitHash } from "./netcheck";

export async function checkPwned(pass: string): Promise<number> {
  const { prefix, suffix } = splitHash(await sha1Hex(pass));
  const r = await fetch(PWNED_URL + prefix, { headers: { "Add-Padding": "true" } });
  if (!r.ok) throw new Error(`range API answered ${r.status}`);
  return pwnedCount(await r.text(), suffix);
}
