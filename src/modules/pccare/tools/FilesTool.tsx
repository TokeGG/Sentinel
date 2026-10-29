import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { ErrorLine } from "../../../ui/kit";
import { groupByMonth, planScreenshots, planSort, type DirFile, type Move } from "../sorter";
import { pickFolder, useTask } from "../useTask";

type Mode = "downloads" | "screenshots";

async function defaultDir(mode: Mode): Promise<string> {
  const path = await import("@tauri-apps/api/path");
  return mode === "downloads" ? path.downloadDir() : path.join(await path.pictureDir(), "Screenshots");
}

// Plan first (pure, shown in full), then Apply moves exactly the plan; Rust re-checks every move.
export function FilesTool() {
  const t = useTask<{ dir: string; files: DirFile[] }>();
  const [mode, setMode] = useState<Mode>("downloads");
  const [rename, setRename] = useState(false);
  const [msg, setMsg] = useState("");
  const load = (m: Mode, dir?: string) => { setMode(m); setMsg(""); return t.go(async () => { const d = dir ?? (await defaultDir(m)); return { dir: d, files: await invoke<DirFile[]>("list_dir_files", { path: d }) }; }); };
  const plan: Move[] = !t.data ? [] : mode === "downloads" ? planSort(t.data.dir, t.data.files) : planScreenshots(t.data.dir, t.data.files, rename);
  const apply = () => t.go(async () => { const n = await invoke<number>("apply_moves", { base: t.data!.dir, moves: plan }); setMsg(`${n} file(s) moved`); return { dir: t.data!.dir, files: await invoke<DirFile[]>("list_dir_files", { path: t.data!.dir }) }; });
  return (
    <div className="pc-tool">
      <div className="ui-actions">
        <button type="button" className="ui-btn" disabled={t.busy} onClick={() => void load("downloads")}>Downloads sorter</button>
        <button type="button" className="ui-btn" disabled={t.busy} onClick={() => void load("screenshots")}>Screenshots</button>
        <button type="button" className="ui-btn" disabled={t.busy} onClick={async () => { const d = await pickFolder(); if (d) void load(mode, d); }}>Other folder…</button>
        {mode === "screenshots" && <label className="ui-meta"><input type="checkbox" checked={rename} onChange={(e) => setRename(e.target.checked)} /> rename by date</label>}
      </div>
      {t.error && <ErrorLine message={t.error} />}
      {t.data && <div className="ui-meta">{t.data.dir} · {t.data.files.length} files · {plan.length} planned move(s) {msg && `· ${msg}`}</div>}
      {mode === "screenshots" && t.data && <div className="ui-meta">{groupByMonth(t.data.files).map((g) => `${g.month}: ${g.files.length}`).join(" · ")}</div>}
      {plan.length > 0 && (
        <>
          <div className="ui-files" aria-label="Planned moves">{plan.map((m) => <div key={m.from}>{m.from} → {m.folder}/{m.name}</div>)}</div>
          <ConfirmButton label={`Apply ${plan.length} move(s)`} disabled={t.busy} onConfirm={() => void apply()} />
        </>
      )}
    </div>
  );
}
