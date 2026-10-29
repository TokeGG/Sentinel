import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { useState } from "react";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { ErrorLine } from "../../../ui/kit";
import { PWNED_URL, pwnedCount, sameHash, sha1Hex, splitHash } from "../netcheck";
import { humanBytes } from "../panelLogic";
import { useTask } from "../useTask";

interface Cache { id: string; browser: string; paths: string[]; bytes: number }

export function SecurityTool() {
  const c = useTask<Cache[]>();
  const h = useTask<string>();
  const pw = useTask<number>();
  const [algo, setAlgo] = useState("sha256");
  const [expect, setExpect] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");
  const clear = (x: Cache) => c.go(async () => { const [ok, bad] = await invoke<[number, number]>("clear_browser_cache", { id: x.id }); setMsg(`${x.browser}: ${ok} removed, ${bad} in use/skipped`); return invoke<Cache[]>("browser_caches"); });
  const hashIt = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const f = await open({ multiple: false }); if (typeof f !== "string") return;
    await h.go(() => invoke<string>("hash_file", { path: f, algo }));
  };
  // Only the first 5 hex chars of the SHA-1 are sent; the password never leaves this panel.
  const check = () => pw.go(async () => { const { prefix, suffix } = splitHash(await sha1Hex(pass)); setPass(""); const r = await fetch(PWNED_URL + prefix, { headers: { "Add-Padding": "true" } }); if (!r.ok) throw new Error(`range API answered ${r.status}`); return pwnedCount(await r.text(), suffix); });
  return (
    <div className="pc-tool">
      <h3 className="ui-sub">Browser caches</h3>
      <button type="button" className="ui-btn" disabled={c.busy} onClick={() => void c.go(() => invoke<Cache[]>("browser_caches"))}>Measure caches</button>
      {msg && <span className="ui-meta"> {msg}</span>}
      {c.error && <ErrorLine message={c.error} />}
      <ul className="pc-list">
        {c.data?.map((x) => (
          <li key={x.id}><b>{x.browser}</b> {humanBytes(x.bytes)}
            <div className="ui-files">{x.paths.map((p) => <div key={p}>{p}</div>)}</div>
            <ConfirmButton className="ui-btn ui-sm" label="Clear this cache" disabled={c.busy} title="Close the browser first; logins and history are not touched" onConfirm={() => void clear(x)} />
          </li>
        ))}
        {c.data && !c.data.length && <li className="ui-meta">No known browser cache found.</li>}
      </ul>
      <h3 className="ui-sub">Hash checker</h3>
      <div className="ui-actions">
        <select className="ui-select" value={algo} onChange={(e) => setAlgo(e.target.value)} aria-label="Algorithm"><option value="sha256">SHA-256</option><option value="md5">MD5</option></select>
        <button type="button" className="ui-btn" disabled={h.busy} onClick={() => void hashIt()}>Pick file…</button>
        <input className="ui-input" value={expect} onChange={(e) => setExpect(e.target.value)} placeholder="Expected hash (optional)" aria-label="Expected hash" />
      </div>
      {h.error && <ErrorLine message={h.error} />}
      {h.data && <div className="pc-path">{h.data} {expect && <b>{sameHash(h.data, expect) ? "MATCH" : "DIFFERENT"}</b>}</div>}
      <h3 className="ui-sub">Password breach check (k-anonymity)</h3>
      <form className="ui-quickadd" onSubmit={(e) => { e.preventDefault(); if (pass) void check(); }}>
        <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password to check" aria-label="Password to check" />
        <button type="submit" className="ui-btn" disabled={pw.busy || !pass}>Check</button>
      </form>
      <div className="ui-meta">Only the first 5 characters of its SHA-1 hash are sent to api.pwnedpasswords.com; nothing is stored.</div>
      {pw.error && <ErrorLine message={pw.error} />}
      {pw.data !== null && <b>{pw.data > 0 ? `Seen in ${pw.data.toLocaleString()} breaches — don't use it.` : "Not found in known breaches."}</b>}
    </div>
  );
}
