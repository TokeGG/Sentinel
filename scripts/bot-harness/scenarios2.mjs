// Five more harness scenarios (login wall, infinite scroll, modal dialog, table extraction, link opening a new tab).
// Same shape as scenarios.mjs: a scripted "model" answering from the live observation, plus a check on the episode.
const J = (o) => JSON.stringify(o);
const find = (obs, role, re) => obs.elements.find((e) => e.role === role && re.test(e.text));

export const SCENARIOS_2 = [
  {
    name: "login wall -> stop and ask the user", start: "/login.html", goal: "list my recent orders",
    decide(obs) {
      if (obs.elements.some((e) => e.role === "password")) return J({ type: "fail", reason: "needs you: this page asks for a sign-in", why: "sign-in wall" });
      return J({ type: "done", result: obs.text.slice(0, 80) });
    },
    check: (ep, ctx) => ep.outcome === "failed" && /sign-in/.test(ep.result ?? ep.steps.at(-1)?.action?.reason ?? "") && !ep.steps.some((s) => s.action?.type === "type") && ctx.confirms === 0,
  },
  {
    name: "infinite scroll until the item loads", start: "/scroll.html", goal: "find which aisle the golden ticket is in",
    decide(obs) {
      const m = /golden ticket is in (aisle \d+)/.exec(obs.text);
      return m ? J({ type: "done", result: m[1] }) : J({ type: "scroll", dir: "down", why: "load more of the feed" });
    },
    check: (ep) => ep.outcome === "done" && ep.result === "aisle 7" && ep.steps.length <= 25,
  },
  {
    name: "modal dialog closed, then answer", start: "/modal.html", goal: "what is the current offer",
    decide(obs) {
      const m = /Spring offer: [^\n]+?May \d+/.exec(obs.text);
      if (m) return J({ type: "done", result: m[0] });
      const x = find(obs, "button", /close/i);
      return x ? J({ type: "click", target: x.id, why: "close the newsletter dialog" }) : J({ type: "fail", reason: "stuck" });
    },
    check: (ep) => ep.outcome === "done" && /20% off garden tools/.test(ep.result) && !ep.steps.some((s) => s.action?.type === "type"),
  },
  {
    name: "table extraction", start: "/table.html", goal: "which platform does the 08:27 train leave from",
    decide(obs) {
      const m = /08:27\s+(\w+)/.exec(obs.text);
      return m ? J({ type: "done", result: `platform ${m[1]}` }) : J({ type: "fail", reason: "no table" });
    },
    check: (ep) => ep.outcome === "done" && ep.result === "platform 7b",
  },
  {
    name: "link opening a new tab stays in the bot's tab", start: "/tabs.html", goal: "find the latest version in the release notes",
    decide(obs) {
      const v = /Latest version: ([\d.]+)/.exec(obs.text);
      if (v) return J({ type: "done", result: v[1] });
      const l = find(obs, "link", /release notes/i);
      return l ? J({ type: "click", target: l.id, why: "open the release notes" }) : J({ type: "fail", reason: "no link" });
    },
    check: (ep) => ep.outcome === "done" && ep.result === "4.2.1",
  },
];
