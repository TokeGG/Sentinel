// Manual update-checker list: apps you track by GitHub repo; "Check now" asks GitHub (button only).
import { useEffect, useState } from "react";
import { ConfirmButton } from "../../../ui/ConfirmButton";
import { validRepo, type UpdateEntry } from "../alerts";
import { checkUpdates, getUpdates, saveUpdates, type UpdateResult } from "../sysOps";
import { useTask } from "../useTask";

export function UpdatesTool() {
  const [list, setList] = useState<UpdateEntry[]>([]);
  const [form, setForm] = useState<UpdateEntry>({ name: "", repo: "", installed: "" });
  const t = useTask<UpdateResult[]>();
  useEffect(() => { getUpdates().then(setList).catch(() => {}); }, []);
  const store = async (next: UpdateEntry[]) => { await saveUpdates(next); setList(await getUpdates()); };
  const f = (k: keyof UpdateEntry) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="pc-tool">
      <div><input className="ui-input" placeholder="Name" aria-label="Name" value={form.name} onChange={f("name")} />
        <input className="ui-input" placeholder="owner/repo" aria-label="GitHub repo" value={form.repo} onChange={f("repo")} />
        <input className="ui-input" placeholder="installed version" aria-label="Installed version" value={form.installed} onChange={f("installed")} />
        <button className="ui-btn" disabled={!form.name.trim() || !validRepo(form.repo)}
          onClick={() => void store([...list, form]).then(() => setForm({ name: "", repo: "", installed: "" }))}>Add</button></div>
      {list.map((e) => (
        <div key={e.repo + e.name}>{e.name} <span className="ui-meta">{e.repo} {e.installed}</span>
          <ConfirmButton className="ui-btn ui-sm" label="Remove" onConfirm={() => void store(list.filter((x) => x !== e))} /></div>
      ))}
      <button className="ui-btn" disabled={t.busy || !list.length} onClick={() => void t.go(() => checkUpdates(list))}>Check now</button>
      {t.data?.map((r) => (
        <div key={r.entry.repo} className="ui-meta">{r.entry.name}: {r.error ?? (r.newer ? `update available (${r.latest})` : `latest ${r.latest ?? "unknown"}`)}</div>
      ))}
    </div>
  );
}
