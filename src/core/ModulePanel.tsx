import type { ModuleManifest } from "./module";
import { useModuleCore } from "../ui/useModule";
import { CredentialFields } from "./panel/CredentialFields";
import { ScheduleToggle } from "./panel/ScheduleToggle";
import { FormView } from "./panel/FormView";
import { ListView } from "./panel/ListView";
import { rowsToMarkdown } from "../shell/extras/textTools";

// The generic panel: renders any module whose manifest declares panel:"list"
// or "table" with no module-specific UI code. Composition only; each section
// lives in ./panel/. Data, busy/error state and the view's refresh interval
// come from useModuleCore (errors surface in PanelRoute's StatusLine).
export function ModulePanel({ module }: { module: ModuleManifest }) {
  const { rows, busy, exec, run: runSkill } = useModuleCore(module);
  // Shared busy -> work -> reload -> idle wrapper for every skill invocation.
  const run = async (fn: () => Promise<unknown>) => void (await exec(fn));

  return (
    <div className="module-panel">
      <h2>{module.name}</h2>
      <p className="module-desc">{module.description}</p>
      <CredentialFields module={module} />
      {(module.actions ?? []).length > 0 && (
        <div className="module-actions">
          {module.actions!.map((a) => (
            <button key={a.skill} disabled={busy} onClick={() => runSkill(a.skill)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <ScheduleToggle module={module} />
      {rows.length > 0 && (
        <button type="button" title="Copy the list as Markdown" onClick={() => void navigator.clipboard.writeText(rowsToMarkdown(module.name, rows))}>
          Copy as Markdown
        </button>
      )}
      <FormView module={module} busy={busy} run={run} />
      <ListView module={module} rows={rows} busy={busy} run={run} />
    </div>
  );
}
