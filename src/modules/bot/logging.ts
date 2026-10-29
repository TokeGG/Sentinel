// Live step log for the panel: text for observations/actions/results, and decorators that report each call of the
// injected driver and model as it happens (the agent loop itself has no callbacks). Pure.
import type { Action, ActionResult, BrowserDriver, Observation } from "./actions.ts";
import type { Llm } from "./llm.ts";

export type LogKind = "page" | "model" | "act" | "result" | "nav" | "info" | "warn";
export interface LogEntry { kind: LogKind; text: string; at: number }
export type LogFn = (kind: LogKind, text: string) => void;

export function describeAction(a: Action): string {
  switch (a.type) {
    case "type": return `type "${a.text.slice(0, 60)}" into [${a.target}]`;
    case "press": return `press ${a.key}`;
    case "scroll": return `scroll ${a.dir}`;
    case "goto": return `go to ${a.url}`;
    case "wait": return "wait";
    case "tool": return `tool ${a.server}/${a.name} ${JSON.stringify(a.args).slice(0, 120)}`;
    case "done": return `done: ${a.result.slice(0, 200)}`;
    case "fail": return `give up: ${a.reason.slice(0, 200)}`;
    default: return `${a.type} [${a.target}]`;
  }
}
export const describeObservation = (o: Observation): string =>
  `${o.title.slice(0, 60) || "(no title)"} - ${o.url.slice(0, 100) || "(no url)"} - ${o.elements.length} elements`;
export const describeResult = (r: ActionResult): string =>
  r.ok ? (r.changed ? "ok, page changed" : "ok, page unchanged") : `failed: ${r.error ?? "?"}${r.timedOut ? " (timed out)" : ""}`;
/** What the model answered, shortened (the raw JSON is the most useful thing to see when it goes wrong). */
export const describeModelReply = (raw: string): string => raw.replace(/\s+/g, " ").slice(0, 240);

export function logDriver(d: BrowserDriver, log: LogFn): BrowserDriver {
  return {
    async observe() { const o = await d.observe(); log("page", describeObservation(o)); return o; },
    async act(a) { log("act", describeAction(a)); const r = await d.act(a); log("result", describeResult(r) + (r.output ? ` -> ${r.output.slice(0, 200)}` : "")); return r; },
  };
}
export function logLlm(l: Llm, log: LogFn): Llm {
  return { async decide(i, s) { const raw = await l.decide(i, s); log("model", describeModelReply(raw)); return raw; } };
}
/** Newest last, bounded (a long run must not grow the panel without limit). */
export const pushLog = (list: LogEntry[], e: LogEntry, max = 400): LogEntry[] => [...list.slice(-(max - 1)), e];
