// Stand-in for the Rust side (src-tauri/src/bot): injects driver.js into a Playwright page and implements the
// bot_open / bot_navigate / bot_run / bot_show / bot_close commands the TS driver invokes, including the
// document.title result channel (`__SB__<nonce>:<id>:<seq>/<n>:<base64>`, chunk.rs) and "navigated" completions
// (session.rs). Results go into the real correlator, so driverCore.ts runs unchanged.
import { readFileSync } from "node:fs";

const DRIVER = readFileSync(new URL("../../src-tauri/src/bot/driver.js", import.meta.url), "utf8");

export async function makeBridge(page, corr) {
  const nonce = "h" + Math.random().toString(36).slice(2, 10);
  const parts = new Map(); // id -> [total, chunks]
  const pending = new Map(); // command id -> navigated?
  const complete = (id, ok, json) => { pending.delete(id); corr.deliver({ id, ok, json }); };
  await page.exposeFunction("__harnessTitle", (t) => {
    const m = /^__SB__([^:]+):([A-Za-z0-9_-]+):(\d+)\/(\d+):([A-Za-z0-9+/=]*)$/.exec(t);
    if (!m || m[1] !== nonce) return;
    const [, , id, seq, total, data] = m;
    const p = parts.get(id) ?? [Number(total), []];
    p[1][Number(seq)] = data; parts.set(id, p);
    if (p[1].filter((x) => x !== undefined).length < p[0]) return;
    parts.delete(id);
    const v = JSON.parse(Buffer.from(p[1].join(""), "base64").toString("utf8"));
    if (pending.has(id)) complete(id, v.ok === true, JSON.stringify(v.v));
  });
  // Observe title changes like WebView2's DocumentTitleChanged (harness-only init script, runs before the driver).
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(Document.prototype, "title");
    Object.defineProperty(Document.prototype, "title", { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); window.__harnessTitle(String(v)); } });
  });
  await page.addInitScript(DRIVER.replace(/__NONCE__/g, nonce));
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) for (const k of pending.keys()) pending.set(k, true); });
  page.on("load", () => { for (const [id, nav] of [...pending]) if (nav) complete(id, true, JSON.stringify({ url: page.url(), navigated: true })); });
  const runScript = (id, js) => `if(window.__sb)window.__sb.__run(${JSON.stringify(id)},async()=>(${js}));`;
  const nav = async (id, url) => { try { await page.goto(url, { waitUntil: "load" }); corr.deliver({ id, ok: true, json: JSON.stringify({ url: page.url(), navigated: true }) }); } catch (e) { corr.deliver({ id, ok: false, json: JSON.stringify(String(e.message)) }); } };
  const calls = [];
  return {
    calls,
    async invoke(cmd, args) {
      calls.push(cmd);
      if (cmd === "bot_open" || cmd === "bot_navigate") { void nav(args.id, args.url); return; }
      if (cmd === "bot_run") {
        if (!String(args.js).startsWith("window.__sb.")) throw new Error("only window.__sb calls may run");
        pending.set(args.scriptId, false);
        await page.evaluate(runScript(args.scriptId, args.js)).catch(() => {}); // a navigation may tear the context down
        return;
      }
      if (cmd === "bot_show" || cmd === "bot_close") return;
      throw new Error(`unknown command ${cmd}`);
    },
  };
}
