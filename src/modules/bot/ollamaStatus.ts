// Pure: what is wrong with the local model, in words the owner can act on.
import { parseTags } from "../skills/localModel.ts";
import type { ModelStatus } from "./panelLogic.ts";

export const SUGGESTED_MODEL = "llama3.1:8b";

export interface OllamaProbe {
  /** Program found on disk; null = unknown (check not available). */
  installed: boolean | null;
  /** ok = /api/tags answered 200; down = nothing listens; forbidden = 403 (origin check); error = other. */
  reach: "ok" | "down" | "forbidden" | "error";
  httpStatus?: number;
  detail?: string;
  tags: unknown | null;
}

export type OllamaKind = "ready" | "not_installed" | "not_running" | "forbidden" | "error" | "no_models" | "no_selection" | "model_missing";

export function diagnoseOllama(model: string | null, p: OllamaProbe): ModelStatus & { kind: OllamaKind } {
  const pull = `ollama pull ${SUGGESTED_MODEL}`;
  if (p.reach === "down") return p.installed === false
    ? { ok: false, kind: "not_installed", text: `Ollama is not installed. Install it from https://ollama.com/download, then run \`${pull}\` and press Check again.` }
    : { ok: false, kind: "not_running", text: "Ollama is not running (nothing answers on 127.0.0.1:11434). Start Ollama from the Start menu (or run `ollama serve`), then Check again." };
  if (p.reach === "forbidden") return { ok: false, kind: "forbidden", text: "Ollama refused the request (HTTP 403, origin check). Restart Sentinel after updating; or set the environment variable OLLAMA_ORIGINS=http://tauri.localhost,https://tauri.localhost and restart Ollama." };
  if (p.reach === "error") return { ok: false, kind: "error", text: `Ollama answered with an error${p.httpStatus ? ` (HTTP ${p.httpStatus})` : ""}${p.detail ? `: ${p.detail.slice(0, 160)}` : ""}. Restart Ollama, then Check again.` };
  const names = parseTags(p.tags).map((m) => m.name);
  if (!names.length) return { ok: false, kind: "no_models", text: `Ollama is running but has no model. Run \`${pull}\` in a terminal, then Check again.` };
  if (!model) return { ok: false, kind: "no_selection", text: `Ollama is running with ${names.length} model(s). No local model selected: choose one in the Skills & MCP panel (Local model).` };
  if (!names.includes(model)) return { ok: false, kind: "model_missing", text: `Model ${model} is selected but not installed in Ollama. Run \`ollama pull ${model}\`, or pick another in Skills & MCP (Local model).` };
  return { ok: true, kind: "ready", text: `Model ${model} is ready (runs on this PC).` };
}

/** Maps a failed request (Rust error text or HTTP status) to the probe's reach. */
export function reachOf(status: number | null, err?: string): OllamaProbe["reach"] {
  if (status === 200) return "ok";
  if (status === 403) return "forbidden";
  if (status !== null) return "error";
  return /not_running|connection refused|failed to fetch|error sending request|connect/i.test(err ?? "") ? "down" : "error";
}

/** Short header label per kind ("local model offline" said nothing about why). */
export const KIND_SHORT: Record<OllamaKind, string> = {
  ready: "local model online", not_installed: "Ollama not installed", not_running: "Ollama not running", forbidden: "Ollama refused (403)",
  error: "Ollama error", no_models: "no model pulled", no_selection: "no model selected", model_missing: "selected model missing",
};
export const shortStatus = (s: ModelStatus & { kind?: OllamaKind }): string => (s.kind ? KIND_SHORT[s.kind] : s.ok ? "local model online" : "checking local model");
