// Generic "Ask" bar mounted by PanelRoute under every custom/list panel (no per-module code). Answers come
// from the local model with citations to the panel's rows; a suggested action runs only after a confirm.
import { useEffect, useState } from "react";
import { getSetting } from "./appSetting";
import { ASSIST_LANG_KEY, cleanLang, DEFAULT_LANG } from "../core/assist/assistTasks";
import type { ModuleManifest } from "../core/module";
import { ConfirmButton } from "./ConfirmButton";
import { ErrorLine } from "./kit";
import { findSkill } from "./moduleRun";
import { useAssist } from "./useAssist";
import "./assist.css";

export function AssistBar({ module: m }: { module: ModuleManifest }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sources, setSources] = useState(false);
  const [ran, setRan] = useState<string | null>(null);
  const { st, ask, task, stop, rate, category } = useAssist(m);
  const [lang, setLang] = useState(DEFAULT_LANG);
  useEffect(() => { void getSetting(ASSIST_LANG_KEY).then((v) => v && setLang(cleanLang(v))).catch(() => {}); }, []);
  if (!open) return <button type="button" className="ui-btn as-open" onClick={() => setOpen(true)} title={`Ask the ${category} assistant about this panel`}>Ask</button>;
  const a = st.answer;
  const run = async (skill: string, label: string) => {
    try { await findSkill(m, skill).run(); setRan(`${label}: done`); } catch (e) { setRan(`${label}: ${String(e)}`); }
  };
  return (
    <section className="as-bar" aria-label="Ask this panel">
      <form className="as-row" onSubmit={(e) => { e.preventDefault(); setRan(null); void ask(q, sources); }}>
        <input className="ui-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about ${m.name} (local model)`} aria-label="Question" />
        {st.busy ? <button type="button" className="ui-btn" onClick={stop}>Stop</button> : <button className="ui-btn primary" disabled={!q.trim()}>Ask</button>}
        <label className="as-src" title="Also query this category's enabled data sources (Settings > Data sources)">
          <input type="checkbox" checked={sources} onChange={(e) => setSources(e.target.checked)} /> sources
        </label>
        <button type="button" className="ui-btn" disabled={st.busy} onClick={() => { setRan(null); void task("summarize", lang); }} title="Summarize this panel (local model)">Summarize</button>
        <button type="button" className="ui-btn" disabled={st.busy} onClick={() => { setRan(null); void task("translate", lang); }} title="Translate the answer (or the panel) into the language at the right">Translate</button>
        <input className="ui-input as-lang" value={lang} onChange={(e) => setLang(e.target.value)} onBlur={() => setLang(cleanLang(lang))} aria-label="Translate into language" size={8} />
        <button type="button" className="ui-btn" onClick={() => setOpen(false)} aria-label="Close Ask">×</button>
      </form>
      {st.busy && <p className="as-muted">Thinking…</p>}
      {st.error && <ErrorLine message={st.error} />}
      {a && (
        <div className="as-answer">
          <p>{a.answer}</p>
          {a.cites.length > 0 && (
            <ul className="as-cites">{a.cites.map((n) => <li key={n}>{st.rows[n - 1]}</li>)}</ul>
          )}
          <div className="as-row">
            {a.action && <ConfirmButton label={`Run "${a.action.label}"`} onConfirm={() => void run(a.action!.skill, a.action!.label)} />}
            <button type="button" className="ui-btn" disabled={!!st.rated} onClick={() => void rate(true)} title="Save as a good example">Good</button>
            <button type="button" className="ui-btn" disabled={!!st.rated} onClick={() => void rate(false)} title="Remember not to answer like this">Bad</button>
            {st.rated && <span className="as-muted">saved to {category} knowledge</span>}
            {ran && <span className="as-muted">{ran}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
