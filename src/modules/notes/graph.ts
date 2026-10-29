// Link graph of notes + one step of a force layout (pure, deterministic).
import { noteTitle, resolveLink, wikiLinks, type NoteRow } from "./noteLogic.ts";

export type GNode = { id: number; title: string; x: number; y: number };
export type GEdge = { from: number; to: number };

export function buildGraph(notes: NoteRow[], w: number, h: number): { nodes: GNode[]; edges: GEdge[] } {
  const live = notes.filter((n) => !n.archived);
  const nodes = live.map((n, i) => {
    const a = (i / Math.max(1, live.length)) * Math.PI * 2;
    return { id: n.id, title: noteTitle(n.body), x: w / 2 + Math.cos(a) * w * 0.3, y: h / 2 + Math.sin(a) * h * 0.3 };
  });
  const seen = new Set<string>();
  const edges: GEdge[] = [];
  for (const n of live) {
    for (const l of wikiLinks(n.body)) {
      const t = resolveLink(live, l);
      const k = t && `${Math.min(n.id, t.id)}-${Math.max(n.id, t.id)}`;
      if (t && t.id !== n.id && !seen.has(k!)) { seen.add(k!); edges.push({ from: n.id, to: t.id }); }
    }
  }
  return { nodes, edges };
}

/** Repulsion between all pairs, springs along edges, pull to the centre; positions stay inside the box. */
export function forceStep(nodes: GNode[], edges: GEdge[], w: number, h: number, k = 60): GNode[] {
  const d = nodes.map(() => [0, 0]);
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      if (!dx && !dy) { dx = 0.01 * (j - i); dy = 0.01; }
      const dist = Math.max(1, Math.hypot(dx, dy));
      const f = (k * k) / dist / dist;
      d[i][0] += dx * f; d[i][1] += dy * f; d[j][0] -= dx * f; d[j][1] -= dy * f;
    }
  }
  for (const e of edges) {
    const a = idx.get(e.from), b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    const dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const f = (dist - k) / dist * 0.2;
    d[a][0] += dx * f; d[a][1] += dy * f; d[b][0] -= dx * f; d[b][1] -= dy * f;
  }
  const m = 14;
  return nodes.map((n, i) => ({
    ...n,
    x: Math.min(w - m, Math.max(m, n.x + Math.max(-20, Math.min(20, d[i][0] + (w / 2 - n.x) * 0.02)))),
    y: Math.min(h - m, Math.max(m, n.y + Math.max(-20, Math.min(20, d[i][1] + (h / 2 - n.y) * 0.02)))),
  }));
}
