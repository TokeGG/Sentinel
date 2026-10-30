// Data for the Settings, Site rules, Prompts, Routines, Stats and Memory sections; reload() after any change.
import { useCallback, useEffect, useState } from "react";
import { getDb } from "../../core/db";
import { listSkills } from "../skills/registry";
import { OLLAMA_TAGS_URL, parseTags, type LocalModel } from "../skills/localModel";
import type { Episode } from "./actions";
import type { SavedPrompt, Routine } from "./library";
import { ollamaFetch } from "./ollamaFetch";
import { loadPrompts, loadRoutines } from "./opsMore";
import { loadRunConfig, type RunConfig } from "./runConfig";
import { episodeLog } from "./sqlMemory";

export interface LoggedRun { id: number; ep: Episode }

async function runLog(): Promise<LoggedRun[]> {
  const q = episodeLog(300);
  const rows = await (await getDb()).select<{ id: number; json: string; thumbs: "up" | "down" | null }[]>(q.sql, q.params);
  return rows.flatMap((r) => { try { return [{ id: r.id, ep: { ...(JSON.parse(r.json) as Episode), thumbs: r.thumbs ?? undefined } }]; } catch { return []; } });
}
async function models(): Promise<LocalModel[]> {
  try { const r = await ollamaFetch(OLLAMA_TAGS_URL); return r.ok ? parseTags(await r.json()) : []; } catch { return []; }
}

export function useMore() {
  const [cfg, setCfg] = useState<RunConfig | null>(null);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [log, setLog] = useState<LoggedRun[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [installed, setInstalled] = useState<LocalModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const [c, p, r, l, s] = await Promise.all([loadRunConfig(), loadPrompts(), loadRoutines(), runLog(), listSkills().catch(() => [])]);
      setCfg(c); setPrompts(p); setRoutines(r); setLog(l); setSkills(s.map((x) => x.name)); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  const findModels = useCallback(async () => setInstalled(await models()), []);
  useEffect(() => { void reload(); void findModels(); }, [reload, findModels]);
  return { cfg, prompts, routines, log, skills, installed, error, reload, findModels };
}
export type More = ReturnType<typeof useMore>;
