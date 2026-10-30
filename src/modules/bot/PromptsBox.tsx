import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { addPrompt, newId, removeById, type SavedPrompt } from "./library";

/** Prompt library: saved goals with Insert (into the goal box), Save current goal, Delete. */
export function PromptsBox({ list, goal, onInsert, run, busy, reload, disabled }: { list: SavedPrompt[]; goal: string; onInsert(t: string): void; run: ModuleState["run"]; busy: boolean; reload(): void; disabled: boolean }) {
  const [sel, setSel] = useState("");
  const [name, setName] = useState("");
  const p = list.find((x) => x.id === sel);
  const put = async (next: SavedPrompt[]) => { if ((await run("save_prompts", { list: next })) !== undefined) reload(); };
  return (
    <div className="ui-quickadd">
      <select className="ui-select" value={sel} onChange={(e) => setSel(e.target.value)} disabled={disabled} aria-label="Saved prompt">
        <option value="">Prompt library ({list.length})...</option>
        {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      {p && <button type="button" className="ui-btn" disabled={disabled} onClick={() => onInsert(p.text)}>Insert</button>}
      {p && <ConfirmButton label="Delete" disabled={busy} onConfirm={() => void put(removeById(list, p.id)).then(() => setSel(""))} />}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name for current goal" aria-label="Prompt name" disabled={disabled} />
      <button type="button" className="ui-btn" disabled={busy || disabled || !goal.trim()} onClick={() => void put(addPrompt(list, newId(Date.now(), Math.random()), name, goal)).then(() => setName(""))}>Save goal</button>
    </div>
  );
}
