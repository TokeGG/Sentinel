// Bot run settings (app_settings `bot_settings`, JSON): model presets fast/smart/tiny mapped to installed Ollama
// models, temperature and context size passed as Ollama options, and the delay between steps. Pure.
export type PresetId = "default" | "fast" | "smart" | "tiny";
export interface BotSettings {
  /** Which model to use: "default" = Skills > Local model. */ preset: PresetId;
  presets: { fast: string; smart: string; tiny: string };
  /** null = the learned brain value. */ temperature: number | null;
  /** 0 = the model's default context. */ numCtx: number;
  /** Extra pause between steps, ms. */ stepDelayMs: number;
  /** Per-goal time limit, s; 0 = the learned brain value. */ wallClockSec: number;
}
export const BOT_SETTINGS_KEY = "bot_settings";
export const PRESET_IDS: readonly PresetId[] = ["default", "fast", "smart", "tiny"];
export const DEFAULT_SETTINGS: BotSettings = { preset: "default", presets: { fast: "", smart: "", tiny: "" }, temperature: null, numCtx: 0, stepDelayMs: 0, wallClockSec: 0 };
export const WALL_MIN = 30, WALL_MAX = 600;
export const CTX_CHOICES = [0, 2048, 4096, 8192, 16384, 32768] as const;
export const MAX_DELAY_MS = 10_000;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const name = (v: unknown) => (typeof v === "string" && v.length <= 200 ? v : "");

/** Tolerant read: anything missing or out of range falls back to the default. */
export function parseBotSettings(json: string | null): BotSettings {
  let o: Record<string, unknown> = {};
  try { const j = JSON.parse(json ?? "{}"); if (j && typeof j === "object" && !Array.isArray(j)) o = j; } catch { /* defaults */ }
  const p = (o.presets && typeof o.presets === "object" ? o.presets : {}) as Record<string, unknown>;
  const t = typeof o.temperature === "number" && Number.isFinite(o.temperature) ? clamp(o.temperature, 0, 2) : null;
  const ctx = Number(o.numCtx);
  const delay = Number(o.stepDelayMs);
  const wall = Number(o.wallClockSec);
  return {
    preset: PRESET_IDS.includes(o.preset as PresetId) ? (o.preset as PresetId) : "default",
    presets: { fast: name(p.fast), smart: name(p.smart), tiny: name(p.tiny) },
    temperature: t === null ? null : Math.round(t * 100) / 100,
    numCtx: Number.isFinite(ctx) ? clamp(Math.round(ctx), 0, 131072) : 0,
    stepDelayMs: Number.isFinite(delay) ? clamp(Math.round(delay), 0, MAX_DELAY_MS) : 0,
    wallClockSec: Number.isFinite(wall) && wall > 0 ? clamp(Math.round(wall), WALL_MIN, WALL_MAX) : 0,
  };
}

/** The model this run uses: the preset's model when set, else the general local model. */
export function modelFor(s: BotSettings, fallback: string): string {
  return s.preset === "default" ? fallback : s.presets[s.preset] || fallback;
}

/** Ollama `options` for a chat call. `learnedTemp` = the brain's temperature. */
export function ollamaOptions(s: BotSettings, learnedTemp = 0.2): Record<string, number> {
  const o: Record<string, number> = { temperature: s.temperature ?? learnedTemp };
  if (s.numCtx > 0) o.num_ctx = s.numCtx;
  return o;
}

/** Suggest presets from installed models by size: tiny = smallest, smart = largest, fast = the middle one. */
export function suggestPresets(models: { name: string; size: number }[]): BotSettings["presets"] {
  const m = [...models].sort((a, b) => a.size - b.size);
  if (!m.length) return { fast: "", smart: "", tiny: "" };
  return { tiny: m[0].name, fast: m[Math.floor((m.length - 1) / 2)].name, smart: m[m.length - 1].name };
}
