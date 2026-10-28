import { useEffect, useState } from "react";
import type { ModuleManifest } from "./module";
import { CredentialFields } from "./panel/CredentialFields";
import { ScheduleToggle } from "./panel/ScheduleToggle";
import { FormView } from "./panel/FormView";
import { ListView } from "./panel/ListView";

// The generic panel: renders any module whose manifest declares panel:"list"
// or "table" with no module-specific UI code. Composition only; each section
// lives in ./panel/.
export function ModulePanel({ module }: { module: ModuleManifest }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (module.load) setRows(await module.load());
  }
  useEffect(() => {
    refresh();
  }, [module.id]);

  // Shared busy -> work -> reload -> idle wrapper for every skill invocation.
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    await fn();
    await refresh();
    setBusy(false);
  }

  return (
    <div className="module-panel">
      <h2>{module.name}</h2>
      <p className="module-desc">{module.description}</p>
      <CredentialFields module={module} />
      {(module.actions ?? []).length > 0 && (
        <div className="module-actions">
          {module.actions!.map((a) => {
            const skill = module.skills.find((s) => s.name === a.skill)!;
            return (
              <button key={a.skill} disabled={busy} onClick={() => run(() => skill.run())}>
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      <ScheduleToggle module={module} />
      <FormView module={module} busy={busy} run={run} />
      <ListView module={module} rows={rows} busy={busy} run={run} />
    </div>
  );
}
