// News toolbar extras: followed topics (feed the taste profile), views, opt-in presets,
// per-source tag/reliability labels and the sports ticker.
import { useEffect, useState } from "react";
import { tokens } from "../../core/taste/features";
import type { Taste } from "../../core/taste/useTaste";
import { Chip } from "../../ui/kit";
import type { ModuleRow, ModuleState } from "../../ui/useModule";
import { PRESETS, RELIABILITY, tickerRows, VIEWS, type NewsView } from "./extras";
import { feedChoiceLabel } from "./panelLogic";
import { addTopic, listSourceMeta, listTopics, removeTopic } from "./store";

type Meta = Awaited<ReturnType<typeof listSourceMeta>>;

export function useTopics() {
  const [topics, setTopics] = useState<string[]>([]);
  const reload = () => void listTopics().then(setTopics).catch(() => {});
  useEffect(reload, []);
  return { topics, reload };
}

export function NewsTools(p: {
  rows: ModuleRow[]; busy: boolean; run: ModuleState["run"]; taste: Taste;
  topics: string[]; reloadTopics: () => void; view: NewsView; setView: (v: NewsView) => void;
}) {
  const [term, setTerm] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const follow = async () => {
    const t = await addTopic(term).catch(() => null);
    if (!t) return;
    setTerm("");
    // A followed topic is a strong "like" for its keywords, so For you ordering boosts it too.
    await p.taste.record({ key: `topic:${t}`, features: tokens(t).map((w) => `kw:${w}`) }, "like");
    p.reloadTopics();
  };
  const ticker = tickerRows(p.rows);
  return (
    <div className="nw-tools">
      {ticker.length > 0 && <div className="nw-ticker" aria-label="Sports ticker">{ticker.map((r) => <span key={String(r.id)}>{String(r.title)}</span>)}</div>}
      <div className="ui-chips">
        {VIEWS.map((v) => <Chip key={v.id} on={p.view === v.id} onClick={() => p.setView(v.id)}>{v.label}</Chip>)}
      </div>
      <div className="nw-topics">
        {p.topics.map((t) => <Chip key={t} on onClick={() => void removeTopic(t).then(p.reloadTopics)}>{t} ×</Chip>)}
        <input className="ui-file-text" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void follow()} placeholder="Follow a topic…" aria-label="Follow a topic" />
      </div>
      <details onToggle={(e) => (e.currentTarget.open ? void listSourceMeta().then(setMeta) : null)}>
        <summary className="ui-meta">Presets & source labels</summary>
        <div className="ui-controls">
          {Object.entries(PRESETS).map(([id, pr]) => (
            <button key={id} type="button" className="ui-btn ui-sm" disabled={p.busy} onClick={() => void p.run("seed_preset", { preset: id }).then(() => listSourceMeta().then(setMeta))}>Add {pr.label}</button>
          ))}
        </div>
        {meta?.map((s) => (
          <div key={s.id} className="nw-srcmeta">
            <span>{feedChoiceLabel(s)}</span>
            <input className="ui-file-text" defaultValue={s.tag} placeholder="tag" aria-label="Source tag" onBlur={(e) => void p.run("set_source_meta", { id: s.id, tag: e.target.value, reliability: s.reliability })} />
            <select defaultValue={s.reliability} aria-label="Reliability" onChange={(e) => void p.run("set_source_meta", { id: s.id, tag: s.tag, reliability: e.target.value })}>
              {RELIABILITY.map((r) => <option key={r} value={r}>{r || "unlabelled"}</option>)}
            </select>
          </div>
        ))}
        <p className="ui-meta">Preset feeds (incl. the ESPN sports ticker) are only added when you press a button; fetched only on Fetch or opt-in auto-refresh.</p>
      </details>
    </div>
  );
}
