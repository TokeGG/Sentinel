// I/O for the panel Ask bar: gathers rows, category skills, knowledge and (opt-in) data sources, asks the
// local model (Ollama on 127.0.0.1 via the Rust ollama_request path), and saves thumbs as knowledge.
import { useCallback, useRef, useState } from "react";
import type { ModuleManifest } from "../core/module";
import { categoryOf } from "../core/categories";
import { buildAssistMessages, parseAssist, pickSkills, safeActions, sourceLines, summarizeRows, type AssistAnswer } from "../core/assist/assistLogic";
import { exampleFromAnswer, lessonFromBadAnswer, retrieveKb } from "../core/knowledge/kbLogic";
import { addKb, loadKb } from "../core/knowledge/store";
import { queryCategory } from "../core/datasources/fetch";
import { noteLines } from "../modules/bot/knowledge";
import { ollamaJson } from "../modules/bot/llm";
import { ollamaFetch } from "../modules/bot/ollamaFetch";
import { listSkills } from "../modules/skills/registry";
import { LOCAL_MODEL_KEY } from "../modules/skills/store";
import { getSetting } from "./appSetting";
import { errorText } from "./moduleRun";

export interface AssistState { busy: boolean; error: string | null; answer: AssistAnswer | null; rows: string[]; question: string; rated: "up" | "down" | null }
const IDLE: AssistState = { busy: false, error: null, answer: null, rows: [], question: "", rated: null };

export function useAssist(m: ModuleManifest) {
  const [st, setSt] = useState<AssistState>(IDLE);
  const abort = useRef<AbortController | null>(null);
  const category = categoryOf(m);
  const actions = safeActions(m.actions ?? []);

  const ask = useCallback(async (question: string, useSources: boolean) => {
    if (!question.trim()) return;
    abort.current?.abort();
    const ac = (abort.current = new AbortController());
    setSt({ ...IDLE, busy: true, question });
    try {
      const raw = m.load ? await m.load() : m.search ? await m.search(question) : [];
      const rows = summarizeRows(raw as Record<string, unknown>[]);
      const skills = pickSkills(category, (await listSkills().catch(() => [])), question);
      const knowledge = noteLines(retrieveKb(await loadKb(category).catch(() => []), question, 4));
      const sources = useSources ? sourceLines(await queryCategory(category, question, ac.signal)) : [];
      const model = (await getSetting(LOCAL_MODEL_KEY).catch(() => null)) ?? "";
      const msgs = buildAssistMessages({ question, moduleName: m.name, category, rows, skills, knowledge, sources, actions });
      const text = await ollamaJson({ fetch: ollamaFetch, model }, msgs, ac.signal);
      setSt({ ...IDLE, question, rows, answer: parseAssist(text, rows.length, actions) });
    } catch (e) {
      setSt({ ...IDLE, question, error: ac.signal.aborted ? "Stopped." : errorText(e) });
    }
  }, [m, category]);

  const stop = useCallback(() => abort.current?.abort(), []);
  const rate = useCallback(async (good: boolean) => {
    if (!st.answer || st.rated) return;
    const e = good ? exampleFromAnswer(category, st.question, st.answer.answer) : lessonFromBadAnswer(category, st.question, st.answer.answer);
    if (!e.ok) return;
    try { await addKb(e.entry); setSt((s) => ({ ...s, rated: good ? "up" : "down" })); }
    catch (err) { setSt((s) => ({ ...s, error: errorText(err) })); }
  }, [st, category]);

  return { st, ask, stop, rate, category, actions };
}
