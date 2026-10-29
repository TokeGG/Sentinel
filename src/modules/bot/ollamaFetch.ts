// fetch-compatible access to the local Ollama through the Rust `ollama_request` command
// (127.0.0.1:11434 only, fixed paths). Rust requests carry no webview Origin, which
// Ollama otherwise answers with 403. Falls back to the http plugin if the command is absent.
import { invoke } from "@tauri-apps/api/core";
import { fetch as pluginFetch } from "@tauri-apps/plugin-http";
import { assertOllamaUrl } from "./llm.ts";

interface Out { status: number; body: string }
const notRegistered = (e: unknown) => /ollama_request.*not found|not found.*ollama_request|unknown command/i.test(String(e));

export const ollamaFetch: typeof fetch = async (input, init) => {
  const url = assertOllamaUrl(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const path = new URL(url).pathname;
  const body = typeof init?.body === "string" ? init.body : null;
  const signal = init?.signal ?? undefined;
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  try {
    const call = invoke<Out>("ollama_request", { path, body, timeoutSecs: body ? 300 : 5 });
    const out = await (signal ? Promise.race([call, new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")), { once: true }))]) : call);
    return new Response(out.body, { status: out.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    if (!notRegistered(e)) throw e instanceof Error ? e : new Error(String(e));
    return pluginFetch(url, init);
  }
};

/** Is the Ollama program installed? null when this build has no check. */
export const ollamaInstalled = (): Promise<boolean | null> =>
  invoke<{ installed: boolean }>("ollama_installed").then((r) => r.installed, () => null);
