import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { EmptyState, ErrorLine } from "../../../ui/kit";
import { humanBytes } from "../panelLogic";
import { pickFolder, useTask } from "../useTask";

type F = { path: string; size: number };

// Size, then SHA-256. Each group keeps its first file by default; ticked copies go to the Recycle Bin after confirm.
export function DupesTool() {
  const t = useTask<F[][]>();
  const [root, setRoot] = useState("");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const scan = async () => {
    const d = await pickFolder(); if (!d) return;
    setRoot(d); setMsg("");
    const g = await t.go(() => invoke<F[][]>("find_duplicates", { path: d }));
    setPick(new Set((g ?? []).flatMap((x) => x.slice(1).map((f) => f.path))));
  };
  const toggle = (p: string) => setPick((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  const bytes = (t.data ?? []).flat().filter((f) => pick.has(f.path)).reduce((a, f) => a + f.size, 0);
  const apply = async () => {
    const paths = [...pick];
    const n = await t.go(async () => { const k = await invoke<number>("trash_files", { root, paths }); setMsg(`${k} file(s) moved to the Recycle Bin`); return invoke<F[][]>("find_duplicates", { path: root }); });
    if (n) setPick(new Set());
  };
  return (
    <div className="pc-tool">
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={t.busy} onClick={() => void scan()}>{t.busy ? "Working…" : "Pick folder to check"}</button>
        {pick.size > 0 && <ConfirmButton label={`Recycle ${pick.size} ticked (${humanBytes(bytes)})`} disabled={t.busy} onConfirm={() => void apply()} />}
        {msg && <span className="ui-meta">{msg}</span>}
      </div>
      {t.error && <ErrorLine message={t.error} />}
      {t.data && !t.data.length && <EmptyState title="No duplicates found" />}
      {t.data?.map((g) => (
        <fieldset key={g[0].path} className="pc-group">
          <legend>{g.length} copies · {humanBytes(g[0].size)} each</legend>
          {g.map((f) => (
            <label key={f.path} className="pc-path"><input type="checkbox" checked={pick.has(f.path)} onChange={() => toggle(f.path)} /> {f.path}</label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
