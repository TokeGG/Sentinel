// Ollama model manager (pure): parse /api/tags and /api/ps, pull progress, benchmark speed, game-mode unload.
export interface Model { name: string; size: number; modified: string }
export function parseTags(body: string): Model[] {
  try {
    const m = JSON.parse(body)?.models;
    return Array.isArray(m) ? m.map((x) => ({ name: String(x.name ?? ""), size: Number(x.size) || 0, modified: String(x.modified_at ?? "") })).filter((x) => x.name) : [];
  } catch { return []; }
}
/** Names of models loaded in memory right now (/api/ps). */
export const loadedNames = (body: string) => parseTags(body).map((m) => m.name);
export const fmtSize = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
export function pullPct(p: { completed?: unknown; total?: unknown }): number | null {
  const c = Number(p.completed), t = Number(p.total);
  return t > 0 && Number.isFinite(c) ? Math.min(100, Math.round((c / t) * 100)) : null;
}
/** Tokens/second from a non-streamed /api/chat reply (eval_count / eval_duration ns). */
export function tokensPerSec(body: string): number | null {
  try {
    const j = JSON.parse(body), n = Number(j.eval_count), d = Number(j.eval_duration);
    return n > 0 && d > 0 ? Math.round((n / (d / 1e9)) * 10) / 10 : null;
  } catch { return null; }
}
export const BENCH_PROMPT = "Count from 1 to 30, separated by spaces.";
export const benchBody = (model: string) => JSON.stringify({ model, stream: false, messages: [{ role: "user", content: BENCH_PROMPT }], options: { num_predict: 64 } });
export const UNLOAD_GAME_KEY = "ollama_unload_game";
export const shouldUnload = (setting: string | null, active: boolean) => active && setting === "1";
export const validModelName = (n: string) => n.length > 0 && n.length <= 120 && !n.includes("..") && /^[A-Za-z0-9._:/-]+$/.test(n);
