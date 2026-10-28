import type { ModuleManifest } from "../module";

export function RowAction({
  module,
  row,
  busy,
  run,
}: {
  module: ModuleManifest;
  row: Record<string, unknown>;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  if (!module.rowAction) return null;
  return (
    <button
      className="row-action"
      disabled={busy}
      onClick={() => {
        const ra = module.rowAction!;
        const skill = module.skills.find((s) => s.name === ra.skill)!;
        return run(() => skill.run({ [ra.argName]: row[ra.fromField] }));
      }}
    >
      {module.rowAction.label}
    </button>
  );
}
