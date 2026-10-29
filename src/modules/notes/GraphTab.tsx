// Link graph of [[wikilinks]] (SVG, a few force steps on change; click opens the note).
import { useMemo } from "react";
import { EmptyState } from "../../ui/kit";
import { buildGraph, forceStep } from "./graph";
import type { NoteRow } from "./noteLogic";

const W = 640, H = 420;

export function GraphTab({ notes, open }: { notes: NoteRow[]; open(id: number): void }) {
  const g = useMemo(() => {
    const { nodes, edges } = buildGraph(notes.slice(0, 300), W, H);
    let n = nodes;
    for (let i = 0; i < 80; i++) n = forceStep(n, edges, W, H);
    return { nodes: n, edges };
  }, [notes]);
  if (!g.nodes.length) return <EmptyState title="No notes yet" hint="Link notes with [[Note title]] to see the graph." />;
  const at = new Map(g.nodes.map((n) => [n.id, n]));
  return (
    <svg className="nt-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${g.nodes.length} notes, ${g.edges.length} links`}>
      {g.edges.map((e) => { const a = at.get(e.from)!, b = at.get(e.to)!; return <line key={`${e.from}-${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}
      {g.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => open(n.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(n.id)}>
          <circle r={6} /><text x={9} y={4}>{n.title}</text>
        </g>
      ))}
    </svg>
  );
}
