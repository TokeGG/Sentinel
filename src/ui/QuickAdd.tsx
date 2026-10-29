// The manifest's quickAdd (one input + Add) for custom panels. The draft is
// cleared only when the skill succeeded (run resolves undefined on failure).
import { useState } from "react";
import type { ModuleManifest } from "../core/module";
import type { ModuleState } from "./useModule";

export function QuickAdd({ module, busy, run }: { module: ModuleManifest; busy: boolean; run: ModuleState["run"] }) {
  const [draft, setDraft] = useState("");
  const q = module.quickAdd;
  if (!q) return null;
  return (
    <form
      className="ui-quickadd"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        if ((await run(q.skill, { [q.argName]: draft })) !== undefined) setDraft("");
      }}
    >
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={q.placeholder} disabled={busy} />
      <button type="submit" className="ui-btn primary" disabled={busy || !draft.trim()}>
        Add
      </button>
    </form>
  );
}
