import { useLimit } from "../../../ui/useOption";
import { pccareLimits } from "../panelLogic";
import { invoke } from "@tauri-apps/api/core";
import { EmptyState, ErrorLine } from "../../../ui/kit";
import { humanBytes } from "../panelLogic";
import { squarify } from "../treemap";
import { pickFolder, useTask } from "../useTask";

interface Scan { total: number; files: number; truncated: boolean; largest: { path: string; size: number }[]; children: { name: string; size: number; dir: boolean }[] }
const W = 600, H = 260;

// Read-only: largest files + a treemap of the folder's top-level entries.
export function DiskTool() {
  const lim = useLimit(pccareLimits, "largestFiles");
  const t = useTask<Scan>();
  const scan = async () => { const d = await pickFolder(); if (d) await t.go(() => invoke<Scan>("scan_folder", { path: d })); };
  const tiles = t.data ? squarify(t.data.children.slice(0, 60), { x: 0, y: 0, w: W, h: H }) : [];
  return (
    <div className="pc-tool">
      <div className="ui-actions">
        <button type="button" className="ui-btn primary" disabled={t.busy} onClick={() => void scan()}>{t.busy ? "Scanning…" : "Pick folder to scan"}</button>
        {t.data && <span className="ui-meta">{t.data.files} files · {humanBytes(t.data.total)}{t.data.truncated ? " · stopped at the file cap" : ""}</span>}
      </div>
      {t.error && <ErrorLine message={t.error} />}
      {t.data && !tiles.length && <EmptyState title="Folder is empty" />}
      {tiles.length > 0 && (
        <svg className="pc-treemap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Disk usage treemap">
          {tiles.map((r) => (
            <g key={r.name}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} className={r.dir ? "dir" : "file"}><title>{`${r.name} — ${humanBytes(r.size)}`}</title></rect>
              {r.w > 60 && r.h > 18 && <text x={r.x + 4} y={r.y + 14}>{r.name.slice(0, Math.floor(r.w / 7))}</text>}
            </g>
          ))}
        </svg>
      )}
      {t.data && (
        <ul className="pc-list">
          {t.data.largest.slice(0, lim).map((f) => <li key={f.path}><b>{humanBytes(f.size)}</b> <span className="pc-path" title={f.path}>{f.path}</span></li>)}
        </ul>
      )}
    </div>
  );
}
