// Lab-mode harness scenarios: fake ACTIVE engagement scoped to the local fixture host (127.0.0.1), scripted model,
// the REAL labVerdict/labLogRow/runner gate (makeRunTool) and parseDraft. The Rust invoke boundary is stubbed:
// tcp_port_scan answers from a fixed table and records every call, so a refused target must never reach it.
import { runAgent } from "../../src/modules/bot/agent.ts";
import { LAB_SERVER, hostOfUrl, labLogRow, labTools, labVerdict } from "../../src/modules/pentest/labBotLogic.ts";
import { makePreview, makeRunTool } from "../../src/modules/pentest/runner.ts";
import { parseDraft } from "../../src/modules/pentest/triage.ts";

const J = (o) => JSON.stringify(o);
const ENG = { id: 7, client: "Harness lab", authRef: "fixture", include: "127.0.0.1", exclude: "", startsAt: "2000-01-01", endsAt: "2099-12-31", notes: "fixtures only", status: "active" };

function labWorld() {
  const runs = [], invoked = [];
  const deps = { engagements: async () => [ENG], ownIps: async () => [], now: () => new Date().toISOString(),
    invoke: async (cmd, args) => { invoked.push(`${cmd} ${args.host}`); return [{ port: 22, open: true }, { port: 80, open: true }, { port: 443, open: false }]; },
    logRun: async (r) => (runs.push(r), runs.length) };
  const runTool = makeRunTool(deps), preview = makePreview(deps);
  const gdeps = { preview: (t) => preview(ENG.id, t), toolMeta: async () => undefined, flags: async () => [] };
  const gate = async (a) => { const v = await labVerdict(a, gdeps); if (!v.allowed) runs.push({ engagementId: ENG.id, ...labLogRow(a, v, "") }); return v; };
  const tool = async (a) => { const out = await runTool(ENG.id, a.name, String(a.args.target ?? ""), {}); if (!out.verdict.allowed) throw new Error(`refused: ${out.verdict.reason}`); return out.summary; };
  return { runs, invoked, gate, tool, preview: gdeps.preview };
}

const LAB = [
  { name: "lab: in-scope tool runs and is logged", start: "/lab.html",
    decide: (obs, h) => (h.length === 0 ? J({ type: "tool", server: LAB_SERVER, name: "port-scan", args: { target: "127.0.0.1" }, why: "scan the in-scope host" }) : J({ type: "done", result: h[0].output ?? "?" })),
    check: (ep, w) => ep.outcome === "done" && /open: 22, 80/.test(ep.result) && w.invoked.length === 1 && w.runs.some((r) => r.toolId === "port-scan" && r.verdict === "allowed") },
  { name: "lab: out-of-scope tool + goto refused, never invoked", start: "/lab.html",
    decide: (obs, h) => [J({ type: "tool", server: LAB_SERVER, name: "port-scan", args: { target: "10.9.9.9" } }), J({ type: "goto", url: "http://127.0.0.2/" }), J({ type: "done", result: "gave up" })][h.length] ?? J({ type: "fail", reason: "x" }),
    check: (ep, w) => w.invoked.length === 0 && ep.steps[0].ok === false && /blocked/.test(ep.steps[0].error) && ep.steps[1].ok === false && w.runs.filter((r) => r.verdict === "refused").length === 2 && !/127\.0\.0\.2/.test(ep.steps.at(-1).url) },
  { name: "lab: click and type refused in Lab mode", start: "/lab.html",
    decide(obs, h) {
      const link = obs.elements.find((e) => e.role === "link"), box = obs.elements.find((e) => e.role === "textbox");
      return [J({ type: "click", target: link.id }), J({ type: "type", target: box.id, text: "x" }), J({ type: "done", result: "ok" })][h.length];
    },
    check: (ep, w) => ep.steps[0].ok === false && /not available in Lab mode/.test(ep.steps[0].error) && ep.steps[1].ok === false && /lab\.html/.test(ep.steps.at(-1).url) && w.runs.filter((r) => r.toolId === "bot:click" || r.toolId === "bot:type").length === 2 },
  { name: "lab: page leaves scope -> run stopped", start: "/labescape.html", escape: true,
    decide: () => J({ type: "wait", ms: 400 }),
    check: (ep) => ep.outcome === "cancelled" },
];

export async function runLab(session, base, deps, report) {
  for (const sc of LAB) {
    const { page, core } = await session({ runTool: null });
    const w = labWorld();
    const stop = new AbortController();
    // Like runner.ts onNav: any top-level navigation the gate does not allow stops the run.
    page.on("framenavigated", async (f) => { if (f !== page.mainFrame() || f.url() === "about:blank") return; const h = hostOfUrl(f.url()); if (!h || !(await w.preview(h)).allowed) stop.abort(); });
    await core.open(base + sc.start, false);
    const ctx = { confirms: 0 };
    const d = { ...deps(core, { decide: async ({ obs, history }) => sc.decide(obs, history) }, ctx), actionGate: w.gate, toolGate: w.gate, tools: labTools() };
    d.driver = { observe: () => core.driver.observe(), act: (a) => (a.type === "tool" ? w.tool(a).then((output) => ({ ok: true, changed: false, output }), (e) => ({ ok: false, changed: false, error: e.message })) : core.driver.act(a)) };
    const ep = await runAgent(d, { goal: "lab goal", signal: stop.signal });
    let ok = false; try { ok = sc.check(ep, w); } catch { ok = false; }
    report(sc.name, ok, ep, `; invoked ${w.invoked.length}, logged ${w.runs.length}`);
    await page.close();
  }
  // Triage: the model drafts a finding from a logged run; nothing is saved until the user confirms.
  const saved = [];
  const run = { id: 1, engagementId: 7, toolId: "port-scan", target: "127.0.0.1", verdict: "allowed", reason: "in scope", summary: "open: 22, 80", args: "", ranAt: "" };
  const draft = parseDraft(J({ title: "SSH and HTTP exposed", severity: "LOW", notes: "Check SSH uses keys." }), run);
  const before = saved.length;
  const confirm = async (ok) => { if (ok && draft.ok) saved.push(draft.value); };
  await confirm(false);
  const afterDecline = saved.length;
  await confirm(true);
  const ok = draft.ok && draft.value.severity === "low" && draft.value.runId === 1 && before === 0 && afterDecline === 0 && saved.length === 1;
  report("lab: triage drafts, saves only on confirm", ok, { outcome: ok ? "done" : "failed", steps: [] }, `; saved after decline ${afterDecline}, after confirm ${saved.length}`);
}
