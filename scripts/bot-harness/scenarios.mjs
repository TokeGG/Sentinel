// Scripted "models" for the harness: each looks at the real observation (from driver.js) and answers like a model
// would, by element role + label, so ids come from the live page. Each scenario: start page, goal, decide, check.
const J = (o) => JSON.stringify(o);
const find = (obs, role, re) => obs.elements.find((e) => e.role === role && re.test(e.text));
const step = (history) => history.filter((s) => s.action).length;

export const SCENARIOS = [
  {
    name: "search box -> results -> product price", start: "/search.html", goal: "find the price of the blue mug",
    decide(obs) {
      if (/product/.test(obs.url)) return J({ type: "done", result: /EUR [\d.]+/.exec(obs.text)?.[0] ?? "?", why: "price visible" });
      const link = find(obs, "link", /blue mug/i);
      if (link) return J({ type: "click", target: link.id, why: "the matching result" });
      const box = find(obs, "textbox", /search/i);
      if (box && !/results/.test(obs.url)) return J({ type: "type", target: box.id, text: "blue mug", why: "search for it" });
      return J({ type: "fail", reason: "lost" });
    },
    // After typing, the next answer presses Enter (form submit through driver.js press -> requestSubmit).
    patch(history, obs) { const last = history[history.length - 1]; return last?.action?.type === "type" && !/results/.test(obs.url) ? J({ type: "press", key: "Enter", why: "submit the search" }) : null; },
    check: (ep) => ep.outcome === "done" && ep.result === "EUR 12.50",
  },
  {
    name: "form fill, password refused, submit asks first", start: "/form.html", goal: "fill the contact form",
    decide(obs, history) {
      const n = step(history);
      const by = (re) => obs.elements.find((e) => re.test(e.text));
      if (n === 0) return J({ type: "type", target: by(/your name/i).id, text: "Ada", why: "name field" });
      if (n === 1) return J({ type: "type", target: by(/email/i).id, text: "ada@example.test", why: "email field" });
      if (n === 2) return J({ type: "type", target: obs.elements.find((e) => e.role === "password").id, text: "hunter2", why: "testing the refusal" });
      if (n === 3) return J({ type: "submit", target: find(obs, "button", /send/i).id, why: "send it" });
      return J({ type: "done", result: /Thanks[^\n]*/.exec(obs.text)?.[0] ?? "no thanks text" });
    },
    check: (ep, ctx) => ep.outcome === "done" && /Thanks Ada \(ada@example.test\)/.test(ep.result) && ep.steps[2].ok === false && /password/.test(ep.steps[2].error) && ctx.confirms === 1,
  },
  {
    name: "pagination via Next", start: "/list.html", goal: "find the golden widget",
    decide(obs) {
      if (/golden widget/i.test(obs.text)) return J({ type: "done", result: /Page \d of 3/.exec(obs.text)[0] });
      const next = find(obs, "link", /^next$/i);
      return next ? J({ type: "click", target: next.id, why: "next page" }) : J({ type: "fail", reason: "no next" });
    },
    check: (ep) => ep.outcome === "done" && ep.result === "Page 3 of 3" && ep.steps.length === 2,
  },
  {
    name: "cookie banner dismissed, then answer", start: "/cookie.html", goal: "find the library opening hours",
    decide(obs) {
      if (/Opening hours/.test(obs.text)) return J({ type: "done", result: /Opening hours: [^\n]+/.exec(obs.text)[0] });
      const rej = find(obs, "button", /reject all/i);
      return rej ? J({ type: "click", target: rej.id, why: "dismiss the cookie banner" }) : J({ type: "fail", reason: "stuck" });
    },
    check: (ep) => ep.outcome === "done" && /Mon-Fri 9:00-17:00/.test(ep.result) && ep.steps[0].why === "dismiss the cookie banner",
  },
];
