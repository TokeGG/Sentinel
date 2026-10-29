// Injected into every top-level page of the bot-browser window (Rust replaces __NONCE__ per session).
// Defines window.__sb = { observe, act, __run }. Results go back to Rust as chunked document.title values
// (`__SB__<nonce>:<id>:<seq>/<n>:<base64>`, see chunk.rs); the real title is restored afterwards.
(() => {
  if (window.__sb || window !== window.top) return;
  const PFX = "__SB__", P = PFX + "__NONCE__:", CH = 1500;
  const td = Object.getOwnPropertyDescriptor(Document.prototype, "title");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let real = "";
  const realTitle = () => { const t = td.get.call(document); return t.startsWith(PFX) ? real : (real = t); };
  const b64 = (s) => {
    const u = new TextEncoder().encode(s); let r = "";
    for (let i = 0; i < u.length; i += 0x8000) r += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(r);
  };
  let queue = Promise.resolve();
  const send = (id, o) => (queue = queue.then(async () => {
    const keep = realTitle(), d = b64(JSON.stringify(o)), n = Math.max(1, Math.ceil(d.length / CH));
    try { for (let i = 0; i < n; i++) { td.set.call(document, P + id + ":" + i + "/" + n + ":" + d.slice(i * CH, (i + 1) * CH)); await sleep(30); } }
    finally { td.set.call(document, keep); }
  }).catch(() => {}));

  const SEL = "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=tab],[role=menuitem],[onclick],[contenteditable]:not([contenteditable=false])";
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const roleOf = (e) => {
    const t = e.tagName;
    if (t === "INPUT") return e.type === "password" ? "password" : ["checkbox", "radio", "submit", "button"].includes(e.type) ? e.type : "textbox";
    return e.getAttribute("role") || { A: "link", BUTTON: "button", SELECT: "select", TEXTAREA: "textbox", SUMMARY: "button" }[t] || "element";
  };
  const labelOf = (e) => clean(e.getAttribute("aria-label") || e.innerText || e.value || e.placeholder || e.title || e.alt || e.name).slice(0, 100);
  const shown = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const bodyText = () => clean(document.body && document.body.innerText);
  const sig = () => hash(location.href + "|" + Math.round(scrollY / 20) + "|" + bodyText().slice(0, 3000) + "|" + (document.body ? document.body.innerHTML.length : 0));
  let els = [];

  const observe = () => {
    els = []; const out = [];
    for (const e of document.querySelectorAll(SEL)) {
      if (els.length >= 200) break;
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      out.push({ id: String(els.length), role: roleOf(e), text: labelOf(e), visible: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth, rect: [r.x, r.y, r.width, r.height].map(Math.round) });
      els.push(e);
    }
    const text = bodyText().slice(0, 4000), de = document.documentElement;
    return { url: location.href, title: realTitle(), text, elements: out, scroll: { x: Math.round(scrollX), y: Math.round(scrollY), max: Math.max(0, de.scrollHeight - innerHeight) }, hash: sig() };
  };

  const setValue = (e, text) => {
    if (e.isContentEditable) { e.textContent = text; }
    else {
      const proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(e, text);
    }
    e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const act = async (a) => {
    const before = sig();
    const pick = () => { const e = els[Number(a.target)]; if (!e || !e.isConnected) throw new Error("unknown element (stale or detached)"); return e; };
    let extra = {};
    switch (a.type) {
      case "click": { const e = pick(); e.scrollIntoView({ block: "center" }); if (e.focus) e.focus(); e.click(); break; }
      case "type": {
        const e = pick();
        if (e.type === "password" || roleOf(e) === "password") throw new Error("password fields are never typed by the bot");
        e.scrollIntoView({ block: "center" }); e.focus(); setValue(e, String(a.text ?? "")); break;
      }
      case "press": {
        const e = document.activeElement || document.body, k = String(a.key);
        for (const t of ["keydown", "keypress", "keyup"]) e.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true, cancelable: true }));
        if (k === "Enter" && e.form && e.form.requestSubmit) e.form.requestSubmit();
        break;
      }
      case "scroll": scrollBy(0, (a.dir === "up" ? -1 : 1) * innerHeight * (Number(a.step) || 0.7)); break;
      case "back": history.back(); break;
      case "wait": break;
      case "extract": extra = { text: a.target === undefined ? bodyText().slice(0, 8000) : clean(pick().innerText).slice(0, 8000) }; break;
      default: throw new Error("unknown action " + a.type);
    }
    await sleep(Number(a.settle) || 450);
    return { changed: sig() !== before, url: location.href, ...extra };
  };

  // Teach-by-demo: while on, the user's own clicks and typing are recorded (role + label + typed value). Password
  // fields are never recorded. Kept in memory and mirrored to this origin's sessionStorage so a same-site page load
  // keeps it; recTake(true) drains the list and turns recording on for a page of another site. Off unless recStart() was called for this tab.
  const RK = "__sb_rec";
  const ss = { get: () => { try { return JSON.parse(sessionStorage.getItem(RK) || "null"); } catch (_) { return null; } }, set: (v) => { try { v ? sessionStorage.setItem(RK, JSON.stringify(v)) : sessionStorage.removeItem(RK); } catch (_) {} } };
  let rec = ss.get();
  const recPush = (e) => { if (!rec) return; rec.ev.push(e); if (rec.ev.length > 500) rec.ev.shift(); ss.set(rec); };
  const target = (e) => (e && e.closest ? e.closest(SEL) : null);
  const secret = (e) => roleOf(e) === "password" || /cc-|one-time-code|current-password|new-password/.test(e.getAttribute("autocomplete") || "");
  document.addEventListener("click", (ev) => { const e = target(ev.target); if (rec && e && ev.isTrusted && !secret(e) && !["textbox", "select"].includes(roleOf(e))) recPush({ kind: "click", role: roleOf(e), text: labelOf(e), url: location.href }); }, true);
  document.addEventListener("change", (ev) => { const e = ev.target; if (rec && e && ev.isTrusted && e.matches && e.matches("input,textarea,select") && !secret(e) && !["checkbox", "radio"].includes(e.type)) recPush({ kind: "type", role: roleOf(e), text: labelOf(e).slice(0, 100) === String(e.value || "").slice(0, 100) ? clean(e.placeholder || e.name || e.getAttribute("aria-label")) : labelOf(e), value: String(e.value || "").slice(0, 2000), url: location.href }); }, true);
  if (rec) recPush({ kind: "nav", role: "", text: "", url: location.href });
  const recStart = () => { rec = { ev: [{ kind: "nav", role: "", text: "", url: location.href }] }; ss.set(rec); return true; };
  const recTake = (keepOn) => { if (!rec && keepOn) recStart(); const ev = rec ? rec.ev : []; if (rec) { rec.ev = []; ss.set(rec); } return ev; };
  const recStop = () => { const ev = recTake(); rec = null; ss.set(null); return ev; };

  const run = (id, fn) => { Promise.resolve().then(fn).then((v) => send(id, { ok: true, v }), (e) => send(id, { ok: false, v: String((e && e.message) || e) })); };
  Object.defineProperty(window, "__sb", { value: Object.freeze({ observe, act, recStart, recTake, recStop, __run: run }), configurable: false });
})();
