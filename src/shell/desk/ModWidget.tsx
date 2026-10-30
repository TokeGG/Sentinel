// A module as a home widget: its unread count and its first rows (titles only); click opens the panel.
import { useEffect, useState } from "react";
import { registry } from "../../core/module";
import { rowTitle } from "../../core/search/rowHits";
import { openById } from "./layoutOps";

export function ModWidget({ id, count, rows, onError }: { id: string; count: number; rows: number; onError(m: string): void }) {
  const m = registry.find((x) => x.id === id);
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => { m?.load?.().then((r) => setLines(r.map(rowTitle).filter(Boolean).slice(0, rows))).catch(() => setLines([])); }, [id, rows]);
  if (!m) return <div className="term-dim">module not found</div>;
  const open = () => openById(id).catch((e) => onError(String(e)));
  return (
    <div>
      <button type="button" className="term-link" onClick={open}><span className="term-n">{count}</span> <span className="term-dim">new · open {m.name.toLowerCase()}</span></button>
      {lines.map((l, i) => <button key={i} type="button" className="term-link" onClick={open}>{l}</button>)}
    </div>
  );
}
