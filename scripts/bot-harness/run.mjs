// Bot integration harness (manual, NOT part of npm test). Real driver.js in Playwright Chromium + the real TS
// driverCore/correlator/agent loop, scripted fake model, local fixture pages. Run from the repo root:
//   node --experimental-strip-types scripts/bot-harness/run.mjs
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { makeCorrelator } from "../../src/modules/bot/correlator.ts";
import { makeDriver } from "../../src/modules/bot/driverCore.ts";
import { runAgent } from "../../src/modules/bot/agent.ts";
import { DEFAULT_BROWSER_BRAIN } from "../../src/modules/bot/brainSpecs.ts";
import { eventsToWorkflow, readEvents } from "../../src/modules/bot/demo.ts";
import { workflowLlm } from "../../src/modules/bot/workflow.ts";
import { makeBridge } from "./bridge.mjs";
import { SCENARIOS } from "./scenarios.mjs";
import { SCENARIOS_2 } from "./scenarios2.mjs";
import { serve } from "./server.mjs";

const { chromium } = createRequire(execSync("npm root -g").toString().trim() + "/")("playwright");
const brain = { ...DEFAULT_BROWSER_BRAIN, waitAfterAction: 250, timeoutSec: 8, retryLimit: 0 };
const { base, close } = await serve();
const browser = await chromium.launch();
let failed = 0;

async function session() {
  const page = await browser.newPage();
  const corr = makeCorrelator();
  const bridge = await makeBridge(page, corr);
  let n = 0;
  const core = makeDriver({ invoke: bridge.invoke, corr, brain, nextId: () => `h-${++n}`, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
  return { page, core, bridge };
}
const deps = (core, llm, ctx) => ({
  driver: core.driver, llm, brain, store: { saveEpisode: () => {} },
  clock: { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
  confirm: async () => { ctx.confirms++; return true; },
});
const report = (name, ok, ep, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${ep.outcome}${ep.result ? ` "${ep.result}"` : ""}, ${ep.steps.length} steps${extra}`);
  if (!ok) for (const s of ep.steps) console.log("      ", JSON.stringify(s.action), s.ok ? "ok" : s.error, s.why ?? "");
};

for (const sc of [...SCENARIOS, ...SCENARIOS_2]) {
  const { page, core } = await session();
  const open = await core.open(base + sc.start, false);
  if (!open.ok) { failed++; console.log(`FAIL  ${sc.name}: open ${open.json}`); continue; }
  const ctx = { confirms: 0 };
  const llm = { decide: async ({ obs, history }) => sc.patch?.(history, obs) ?? sc.decide(obs, history) };
  const ep = await runAgent(deps(core, llm, ctx), { goal: sc.goal });
  report(sc.name, sc.check(ep, ctx), ep);
  await page.close();
}

// Teach-by-demo: record real (trusted) clicks/typing via driver.js, then replay the draft through the agent loop.
{
  const { page, core } = await session();
  await core.open(base + "/form.html", true);
  await core.exec("window.__sb.recStart()");
  await page.fill("input[name=name]", "Grace");
  await page.fill("input[name=pw]", "secret-pw");
  await page.fill("input[name=email]", "grace@example.test");
  await page.click("text=Send");
  const events = readEvents(await core.exec("window.__sb.recStop()"));
  const wf = eventsToWorkflow(events, "contact", "fill contact");
  const leaked = JSON.stringify(events).includes("secret-pw");
  await page.goto(base + "/form.html");
  const ctx = { confirms: 0 };
  const ep = await runAgent(deps(core, workflowLlm(wf), ctx), { goal: wf.goal });
  const thanks = await page.textContent("#out");
  report("teach-by-demo record + replay", !leaked && wf.steps.length === 3 && wf.steps[2].action.type === "submit" && ctx.confirms === 1 && ep.outcome === "done" && thanks === "Thanks Grace (grace@example.test)", ep, `; recorded ${wf.steps.length} steps, password recorded: ${leaked}, confirms: ${ctx.confirms}`);
  await page.close();
}

await browser.close();
close();
console.log(failed ? `${failed} scenario(s) failed` : "all scenarios passed");
process.exit(failed ? 1 : 0);
