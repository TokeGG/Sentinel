// Is Ollama installed and running, does it have models, is the chosen one installed? (127.0.0.1:11434 only.)
import { useCallback, useEffect, useState } from "react";
import { OLLAMA_TAGS_URL } from "../skills/localModel";
import { getSetting, LOCAL_MODEL_KEY } from "../skills/store";
import type { ModelStatus } from "./panelLogic";
import { ollamaFetch, ollamaInstalled } from "./ollamaFetch";
import { diagnoseOllama, reachOf, type OllamaProbe } from "./ollamaStatus";

export async function probeOllama(): Promise<OllamaProbe> {
  try {
    const r = await ollamaFetch(OLLAMA_TAGS_URL, { signal: AbortSignal.timeout(5000) });
    const reach = reachOf(r.status);
    const tags = reach === "ok" ? await r.json().catch(() => null) : null;
    return { installed: reach === "ok" ? true : await ollamaInstalled(), reach, httpStatus: r.status, tags, detail: reach === "error" ? (await r.text().catch(() => "")) : undefined };
  } catch (e) {
    return { installed: await ollamaInstalled(), reach: reachOf(null, String(e)), detail: String(e), tags: null };
  }
}

export function useModelStatus() {
  const [status, setStatus] = useState<ModelStatus>({ ok: false, text: "Checking the local model..." });
  const check = useCallback(async () => {
    setStatus({ ok: false, text: "Checking the local model..." });
    const model = await getSetting(LOCAL_MODEL_KEY).catch(() => null);
    setStatus(diagnoseOllama(model, await probeOllama()));
  }, []);
  useEffect(() => void check(), [check]);
  return { status, check };
}
