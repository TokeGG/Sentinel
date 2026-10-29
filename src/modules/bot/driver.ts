// Tauri wiring for the browser driver: bot_* commands via invoke, `bot-result` events into the correlator.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Action } from "./actions";
import type { Brain } from "./kernel/brain";
import { makeCorrelator, failureText, type BotResult } from "./correlator";
import { makeDriver } from "./driverCore";
import { START_URL } from "./panelLogic";

export interface OpenOpts {
  brain: Brain;
  visible: boolean;
  /** Lab mode opens an in-scope page instead of the default search page. */
  startUrl?: string;
  runTool?(a: Extract<Action, { type: "tool" }>): Promise<string>;
  /** Every top-level navigation the window attempted (allowed or denied). */
  onNav?(url: string, allowed: boolean): void;
  /** The browser was stopped from outside (game mode, app exit, window closed). */
  onStopped?(why: string): void;
}

export async function openBrowserDriver(o: OpenOpts) {
  const corr = makeCorrelator();
  const unlisten = await Promise.all([
    listen<BotResult>("bot-result", (e) => corr.deliver(e.payload)),
    listen<{ url: string; allowed: boolean }>("bot-nav", (e) => o.onNav?.(e.payload.url, e.payload.allowed)),
    listen<string>("bot-stopped", (e) => { corr.failAll("stopped"); o.onStopped?.(String(e.payload)); }),
  ]);
  const stamp = Date.now().toString(36);
  let n = 0;
  const core = makeDriver({
    invoke: (cmd, args) => invoke(cmd, args), corr, brain: o.brain, nextId: () => `${stamp}-${++n}`,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)), runTool: o.runTool,
  });
  let disposed = false;
  const dispose = () => { if (!disposed) { disposed = true; unlisten.forEach((f) => f()); } };
  const first = await core.open(o.startUrl ?? START_URL, o.visible);
  if (!first.ok) { await core.close(); dispose(); throw new Error(`could not open the bot browser: ${failureText(first)}`); }
  return { ...core, close: async () => { await core.close(); dispose(); } };
}
