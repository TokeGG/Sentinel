// Is a local model chosen, is Ollama answering, is the model installed? (Looks at 127.0.0.1:11434 only.)
import { fetch } from "@tauri-apps/plugin-http";
import { useCallback, useEffect, useState } from "react";
import { OLLAMA_TAGS_URL } from "../skills/localModel";
import { getSetting, LOCAL_MODEL_KEY } from "../skills/store";
import { modelStatus, type ModelStatus } from "./panelLogic";

export function useModelStatus() {
  const [status, setStatus] = useState<ModelStatus>({ ok: false, text: "Checking the local model..." });
  const check = useCallback(async () => {
    const model = await getSetting(LOCAL_MODEL_KEY).catch(() => null);
    let tags: unknown | null = null;
    if (model) {
      try { const r = await fetch(OLLAMA_TAGS_URL, { signal: AbortSignal.timeout(3000) }); tags = r.ok ? await r.json() : null; } catch { tags = null; }
    }
    setStatus(modelStatus(model, tags));
  }, []);
  useEffect(() => void check(), [check]);
  return { status, check };
}
