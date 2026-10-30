// Run cost meter: steps, wall time, model and the token counts Ollama reports (prompt_eval_count / eval_count). Pure.
import type { Episode } from "./actions.ts";

export interface RunCost { model: string; calls: number; promptTokens: number; outputTokens: number; /** false = Ollama sent no counts */ tokensKnown: boolean }
export const emptyCost = (model: string): RunCost => ({ model, calls: 0, promptTokens: 0, outputTokens: 0, tokensKnown: false });

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Adds one /api/chat reply's counts (the reply JSON as parsed). */
export function addUsage(c: RunCost, reply: unknown): RunCost {
  const r = (reply ?? {}) as { prompt_eval_count?: unknown; eval_count?: unknown };
  const p = n(r.prompt_eval_count), o = n(r.eval_count);
  return { ...c, calls: c.calls + 1, promptTokens: c.promptTokens + (p ?? 0), outputTokens: c.outputTokens + (o ?? 0), tokensKnown: c.tokensKnown || p !== null || o !== null };
}

export function fmtMs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** One line for the result card and past runs: "7 steps, 42 s, llama3:8b, 3 calls, 5,120 + 310 tokens". */
export function costLine(ep: Pick<Episode, "steps" | "startedAt" | "endedAt"> & { cost?: RunCost }): string {
  const parts = [`${ep.steps.length} steps`, fmtMs(ep.endedAt - ep.startedAt)];
  const c = ep.cost;
  if (c) {
    if (c.model) parts.push(c.model);
    parts.push(`${c.calls} model call${c.calls === 1 ? "" : "s"}`);
    parts.push(c.tokensKnown ? `${c.promptTokens.toLocaleString("en-US")} in + ${c.outputTokens.toLocaleString("en-US")} out tokens` : "tokens not reported");
  }
  return parts.join(", ");
}
