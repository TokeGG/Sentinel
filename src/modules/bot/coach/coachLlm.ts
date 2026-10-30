// One JSON chat turn on the chosen local model (Ollama 127.0.0.1 via ollamaFetch only) + the Run command glue.
import { invoke } from "@tauri-apps/api/core";
import { getSetting, LOCAL_MODEL_KEY } from "../../skills/store";
import { ollamaJson, type ChatMessage } from "../llm";
import { ollamaFetch } from "../ollamaFetch";
import type { Lang } from "./prompts";
import { capRun, type RunResult } from "./runCap";

export async function askCoach(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const model = (await getSetting(LOCAL_MODEL_KEY)) ?? "";
  return ollamaJson({ fetch: ollamaFetch, model }, messages, signal);
}

/** Runs code with the owner's own python/node (Rust `coach_run_code`: temp file, timeout, capped output). Owner-triggered only. */
export async function runCode(lang: Lang, code: string, stdin: string): Promise<RunResult> {
  return capRun(await invoke<RunResult>("coach_run_code", { lang, code, stdin, timeoutSecs: 10 }));
}
