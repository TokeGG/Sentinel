// Pure helpers for the Bot panel.
import type { Action, Observation, Outcome } from "./actions.ts";
import { MISTAKE_LABELS, type MistakeCounts, type MistakeKind } from "./mistakes.ts";
import { parseTags } from "../skills/localModel.ts";

export const botSections = [
  { id: "run", label: "Run" },
  { id: "log", label: "Step log and past runs" },
  { id: "knowledge", label: "Knowledge" },
  { id: "brain", label: "Brain" },
];

/** First page of every run (a plain search page; the model goes elsewhere with goto). */
export const START_URL = "https://duckduckgo.com/";

export type ModelStatus = { ok: boolean; text: string };
/** `tags`: the parsed JSON of Ollama /api/tags, or null when Ollama did not answer. */
export function modelStatus(model: string | null, tags: unknown | null): ModelStatus {
  if (!model) return { ok: false, text: "No local model selected. Choose one in the Skills & MCP panel (Local model)." };
  if (tags === null) return { ok: false, text: "Ollama is not running at 127.0.0.1:11434. Start Ollama, then check again." };
  const names = parseTags(tags).map((m) => m.name);
  return names.includes(model)
    ? { ok: true, text: `Model ${model} is ready (runs on this PC).` }
    : { ok: false, text: `Model ${model} is not installed in Ollama. Pick another in the Skills & MCP panel (Local model).` };
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  done: "finished", failed: "gave up", maxSteps: "hit the step limit", timeout: "ran out of time", loop: "stuck in a loop", cancelled: "stopped", denied: "you declined an action",
};

/** What the confirm dialog shows: the page and the proposed irreversible action. */
export function confirmText(a: Action, o: Observation): { page: string; action: string; element: string } {
  const id = "target" in a ? a.target : "";
  const el = o.elements.find((e) => e.id === id);
  return { page: `${o.title.slice(0, 80) || "(no title)"} - ${o.url.slice(0, 200)}`, action: a.type, element: el ? `${el.role}: ${el.text}` : id ? `[${id}]` : "" };
}

export function mistakeLines(c: MistakeCounts): string[] {
  return (Object.entries(c) as [MistakeKind, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${n} x ${MISTAKE_LABELS[k]}`);
}

export interface EpisodeRow { id: number; goal: string; outcome: string; steps: number; thumbs: string | null; created_at: string }
export const episodeLabel = (e: EpisodeRow): string => `${e.goal.slice(0, 80)} - ${OUTCOME_LABEL[e.outcome as Outcome] ?? e.outcome}, ${e.steps} steps`;

/** Whether a note-from-URL address may be fetched: http(s) only. */
export function noteUrlOk(u: string): boolean {
  try { return /^https?:$/.test(new URL(u.trim()).protocol); } catch { return false; }
}

/** Terminal animations run unless reduced motion is requested and not overridden by the app setting. */
export const fxOn = (reducedMotion: boolean, ignoreReduced: boolean) => !reducedMotion || ignoreReduced;
