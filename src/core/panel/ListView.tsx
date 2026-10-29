import { openLink as openUrl } from "../../ui/openLink"; // in-app browser or system (links_open_in)
import type { ModuleManifest } from "../module";
import { RowAction } from "./RowAction";

export function ListView({
  module,
  rows,
  busy,
  run,
}: {
  module: ModuleManifest;
  rows: Record<string, unknown>[];
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  return (
    <ul className="module-list">
      {rows.map((r) => (
        <li key={String(r.id)}>
          {r.title && typeof r.link === "string" && r.link ? (
            // A real button, not an <a href>: Tauri's opener plugin
            // intercepts anchor clicks app-wide, including bare "#" ones
            // with no real target, and tries to open them externally —
            // calling openUrl explicitly, only when there's a real link,
            // avoids that misfire entirely.
            <button
              type="button"
              className="row-link"
              onClick={() => openUrl(r.link as string)}
            >
              {String(r.title)}
            </button>
          ) : r.title ? (
            <span>{String(r.title)}</span>
          ) : (
            <span>{String(r.body ?? JSON.stringify(r))}</span>
          )}
          {r.label ? <em> — {String(r.label)}</em> : null}
          {r.filed_to ? <em> — filed: {String(r.filed_to)}</em> : null}
          <RowAction module={module} row={r} busy={busy} run={run} />
        </li>
      ))}
      {rows.length === 0 && <li className="empty">Nothing here yet.</li>}
    </ul>
  );
}
