// Search provider registry: the palette asks every provider and merges the
// ranked hits. Providers register themselves (shell commands, panels, skills,
// module content); the shell never branches on a specific module.
import { rank } from "./fuzzy.ts";

export type HitKind = "panel" | "command" | "skill" | "setting" | "content";
export type Hit = {
  key: string; // unique across providers
  title: string;
  subtitle?: string;
  kind: HitKind;
  run: () => Promise<unknown> | void;
};
export type Provider = { id: string; label: string; search: (q: string) => Promise<Hit[]> | Hit[] };

const providers: Provider[] = [];
const KIND_BOOST: Record<HitKind, number> = { panel: 40, command: 30, setting: 20, skill: 10, content: 0 };

export function registerSearchProvider(p: Provider): () => void {
  const i = providers.findIndex((x) => x.id === p.id);
  if (i >= 0) providers.splice(i, 1, p);
  else providers.push(p);
  return () => {
    const j = providers.indexOf(p);
    if (j >= 0) providers.splice(j, 1);
  };
}
export const listProviders = (): readonly Provider[] => providers;

/** Ask all providers; a failing provider is skipped (its error reported via onError). */
export async function searchAll(q: string, limit = 40, onError?: (id: string, e: unknown) => void, from: readonly Provider[] = providers): Promise<Hit[]> {
  const res = await Promise.allSettled(from.map(async (p) => p.search(q)));
  const all: Hit[] = [];
  const seen = new Set<string>();
  res.forEach((r, i) => {
    if (r.status === "rejected") return onError?.(from[i].id, r.reason);
    for (const h of r.value) if (!seen.has(h.key)) { seen.add(h.key); all.push(h); }
  });
  return rank(all, q, (h) => `${h.title} ${h.subtitle ?? ""}`, limit, (h) => KIND_BOOST[h.kind]);
}
