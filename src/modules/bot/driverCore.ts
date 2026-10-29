// BrowserDriver over the Rust `bot_*` commands. Pure: `invoke` and the correlator are injected (driver.ts wires Tauri).
// Safety here: never types into a password field (checked on the last observation; driver.js checks again),
// goto goes through bot_navigate (http/https only), tool actions go through the injected `runTool` (the MCP gate).
import type { Action, ActionResult, BrowserDriver, Observation, PageElement } from "./actions.ts";
import type { Brain } from "./kernel/brain.ts";
import { failureText, isTimeout, type BotResult, type Correlator } from "./correlator.ts";

export type Invoke = (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
export interface DriverDeps {
  invoke: Invoke;
  corr: Correlator;
  brain: Brain;
  nextId(): string;
  sleep(ms: number): Promise<void>;
  /** Tool actions (MCP, already gated by the caller's toolGate); returns the reply text. */
  runTool?(a: Extract<Action, { type: "tool" }>): Promise<string>;
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
export const errorObservation = (why: string): Observation => ({ url: "", title: "", text: `(browser unavailable: ${why})`, elements: [], hash: `err:${why}` });

/** Defensive read of what the page sent back (page content is untrusted). */
export function toObservation(v: unknown): Observation | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.elements) || typeof o.hash !== "string") return null;
  const elements: PageElement[] = o.elements.slice(0, 200).map((e: Record<string, unknown>) => ({ id: str(e?.id, 12), role: str(e?.role, 30), text: str(e?.text, 100), visible: e?.visible === true })).filter((e) => e.id !== "");
  return { url: str(o.url, 2000), title: str(o.title, 300), text: str(o.text, 4000), elements, hash: str(o.hash, 40) };
}

/** The window.__sb.act(...) call for a page action, or null when the action is not a page action. */
export function actScript(a: Action, brain: Brain): string | null {
  const settle = Math.min(3000, Math.max(200, Math.round(brain.waitAfterAction ?? 900)));
  let body: Record<string, unknown>;
  switch (a.type) {
    case "click": case "submit": case "purchase": case "delete": case "login": body = { type: "click", target: a.target }; break;
    case "type": body = { type: "type", target: a.target, text: a.text }; break;
    case "press": body = { type: "press", key: a.key }; break;
    case "scroll": body = { type: "scroll", dir: a.dir, step: brain.scrollStep ?? 0.7 }; break;
    case "wait": body = { type: "wait" }; break;
    default: return null;
  }
  return `window.__sb.act(${JSON.stringify({ ...body, settle })})`;
}

/** Refusal text when `a` would type into a password field of the last observation. */
export function typeRefusal(a: Action, last: Observation | null): string | null {
  if (a.type !== "type") return null;
  const el = last?.elements.find((e) => e.id === a.target);
  return el?.role === "password" ? "password fields are never typed by the bot" : null;
}

export function makeDriver(d: DriverDeps) {
  let last: Observation | null = null;
  const ms = () => Math.max(5, d.brain.timeoutSec ?? 15) * 1000;

  async function send(cmd: string, args: Record<string, unknown>, wait: number, idKey: string): Promise<BotResult> {
    const id = d.nextId();
    const p = d.corr.expect(id, wait + 2000);
    try { await d.invoke(cmd, { [idKey]: id, ...args, timeoutMs: wait }); } catch (e) { d.corr.cancel(id, String((e as Error)?.message ?? e)); }
    return p;
  }
  const run = (js: string, wait = ms()) => send("bot_run", { js }, wait, "scriptId");
  const parse = (r: BotResult): unknown => { try { return JSON.parse(r.json); } catch { return null; } };

  const driver: BrowserDriver = {
    async observe() {
      for (let i = 0; i < 3; i++) {
        const r = await run("window.__sb.observe()");
        if (!r.ok) return (last = errorObservation(failureText(r)));
        const v = parse(r) as { navigated?: boolean } | null;
        if (v?.navigated) { await d.sleep(300); continue; } // the page changed under us: look again
        const o = toObservation(v);
        if (o) return (last = o);
      }
      return (last = errorObservation("page did not settle"));
    },
    async act(a: Action): Promise<ActionResult> {
      const refuse = typeRefusal(a, last);
      if (refuse) return { ok: false, error: refuse, changed: false };
      if (a.type === "goto") {
        const r = await send("bot_navigate", { url: a.url }, ms() * 2, "id");
        return r.ok ? { ok: true, changed: true } : { ok: false, error: failureText(r), changed: false, timedOut: isTimeout(r) };
      }
      if (a.type === "tool") {
        if (!d.runTool) return { ok: false, error: "no tool runner", changed: false };
        try { return { ok: true, changed: false, output: await d.runTool(a) }; } catch (e) { return { ok: false, error: String((e as Error)?.message ?? e), changed: false }; }
      }
      const js = actScript(a, d.brain);
      if (!js) return { ok: false, error: `not a page action: ${a.type}`, changed: false };
      const r = await run(js);
      if (!r.ok) return { ok: false, error: failureText(r), changed: false, timedOut: isTimeout(r) };
      const v = parse(r) as { changed?: boolean } | null;
      return { ok: true, changed: v?.changed === true };
    },
  };
  return {
    driver,
    open: (url: string, visible: boolean) => send("bot_open", { url, visible }, ms() * 2, "id"),
    show: (visible: boolean) => d.invoke("bot_show", { visible }),
    /** Run a window.__sb.* call and return its value (teach-by-demo); null on failure. */
    exec: async (js: string): Promise<unknown> => { const r = await run(js); return r.ok ? parse(r) : null; },
    close: async () => { d.corr.failAll("closed"); await d.invoke("bot_close", {}).catch(() => {}); },
  };
}
