// Panel state for one run at a time: live log, confirm request, result, Stop. The run starts only from start().
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, Observation } from "./actions";
import { pushLog, type LogEntry } from "./logging";
import { runBot, type LabHooks, type RunResult } from "./runner";
import type { Workflow } from "./workflow";

export interface ConfirmReq { action: Action; obs: Observation; answer(ok: boolean): void; /** Step approval (every action) rather than the irreversible-action confirm. */ step?: boolean; why?: string }
export interface StartOpts { preApproved: boolean; dryRun?: boolean; stepApproval?: boolean; workflow?: Workflow }

export function useBotRun(onFinished: () => void) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmReq | null>(null);
  const [visible, setVisible] = useState(false);
  const ac = useRef<AbortController | null>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; ac.current?.abort(); }; }, []); // closing the panel stops the run

  const ask = (q: Omit<ConfirmReq, "answer">) => new Promise<boolean>((res) => { if (live.current) setConfirm({ ...q, answer: (ok) => { setConfirm(null); res(ok); } }); else res(false); });
  /** Resolves with the run result (null on error or when a run is already going); routines and job previews await it. */
  const start = useCallback(async (goal: string, opts: StartOpts, lab?: LabHooks): Promise<RunResult | null> => {
    if (ac.current) return null;
    let out: RunResult | null = null;
    const c = (ac.current = new AbortController());
    setLog([]); setResult(null); setError(null); setRunning(true);
    const add = (kind: LogEntry["kind"], text: string) => live.current && setLog((l) => pushLog(l, { kind, text, at: Date.now() }));
    try {
      const r = await runBot({
        goal, preApproved: opts.preApproved, dryRun: opts.dryRun, workflow: opts.workflow, lab, showWindow: visible, signal: c.signal, log: add,
        confirm: (action, obs) => ask({ action, obs }),
        approve: opts.stepApproval ? (action, obs, why) => ask({ action, obs, step: true, why }) : undefined,
      });
      out = r;
      if (live.current) setResult(r);
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      ac.current = null;
      if (live.current) { setRunning(false); setConfirm(null); onFinished(); }
    }
    return out;
  }, [visible, onFinished]);

  const stop = useCallback(() => { confirm?.answer(false); ac.current?.abort(); }, [confirm]);
  const setShow = useCallback((v: boolean) => { setVisible(v); if (ac.current) void invoke("bot_show", { visible: v }).catch(() => {}); }, []);
  return { log, running, result, error, confirm, visible, start, stop, setShow };
}
