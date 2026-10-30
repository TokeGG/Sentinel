// Tauri glue for the model manager: list/ps via ollamaFetch, pull/delete/unload via Rust commands (127.0.0.1 only).
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getSetting } from "../../ui/appSetting";
import { ollamaFetch } from "./ollamaFetch";
import { benchBody, loadedNames, parseTags, shouldUnload, tokensPerSec, UNLOAD_GAME_KEY, type Model } from "./models";

const BASE = "http://127.0.0.1:11434";
export const listModels = async (): Promise<Model[]> => parseTags(await (await ollamaFetch(`${BASE}/api/tags`)).text());
export const loadedModels = async () => loadedNames(await (await ollamaFetch(`${BASE}/api/ps`)).text());
export const deleteModel = (name: string) => invoke("ollama_delete", { name });
export const unloadModel = (name: string) => invoke("ollama_unload", { name });
export async function pullModel(name: string, onProgress: (p: { status: string; completed?: number; total?: number }) => void) {
  const un = await listen<{ name: string; status: string; completed?: number; total?: number }>("ollama-pull", (e) => { if (e.payload.name === name) onProgress(e.payload); });
  try { return await invoke<string>("ollama_pull", { name }); } finally { un(); }
}
export async function benchmark(name: string): Promise<{ tps: number | null; secs: number }> {
  const t = performance.now();
  const r = await ollamaFetch(`${BASE}/api/chat`, { method: "POST", body: benchBody(name) });
  return { tps: tokensPerSec(await r.text()), secs: Math.round((performance.now() - t) / 100) / 10 };
}
/** Game mode started: unload every loaded model, only if the user opted in. Errors are swallowed (Ollama may be off). */
export async function unloadOnGameMode(active: boolean) {
  try {
    if (!shouldUnload(await getSetting(UNLOAD_GAME_KEY), active)) return;
    for (const n of await loadedModels()) await unloadModel(n);
  } catch { /* Ollama not running */ }
}
