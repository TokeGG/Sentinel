import { useEffect, useState } from "react";
import { registry } from "../../core/module";
import { Row } from "../../ui/kit";
import { getAppearance, setAppearance } from "../settingsStore";
import { sanitizeAppearance, type Appearance } from "../settingsLogic";
import { applyToAll } from "./applyAll";
import { Head } from "./Switch";

export function AppearanceSection({ onError }: { onError(e: unknown): void }) {
  const [a, setA] = useState<Appearance>(() => sanitizeAppearance(null));
  const [ready, setReady] = useState(false);
  const [useAccent, setUseAccent] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    getAppearance().then((v) => { setA(v); setReady(true); }).catch((e) => { setReady(true); onError(e); });
  }, []);
  const save = (patch: Partial<Appearance>) => {
    const next = sanitizeAppearance({ ...a, ...patch });
    setA(next);
    setNote(null);
    setAppearance(next).catch(onError);
  };
  const apply = async () => {
    setConfirm(false);
    try {
      await setAppearance(a);
      const n = await applyToAll(registry, a, useAccent);
      setNote(`Updated ${n} panels. Panels that are already open pick this up after you reopen them.`);
    } catch (e) { onError(e); }
  };
  return (
    <section className="st-section" aria-label="Appearance">
      <Head>Appearance</Head>
      <Row end={<input type="color" aria-label="Default accent" value={a.accent} disabled={!ready}
        onChange={(e) => save({ accent: e.target.value })} />}>Default accent</Row>
      <Row end={<select className="ui-select" aria-label="Density" value={a.density} disabled={!ready}
        onChange={(e) => save({ density: e.target.value as Appearance["density"] })}>
        <option value="roomy">Roomy</option><option value="compact">Compact</option></select>}>Density</Row>
      <Row end={<><input type="range" aria-label="Font size" min={0.8} max={1.4} step={0.05} value={a.fontScale}
        disabled={!ready} onChange={(e) => save({ fontScale: Number(e.target.value) })} />
        <span>{Math.round(a.fontScale * 100)}%</span></>}>Font size</Row>
      <label className="st-switch"><input type="checkbox" checked={useAccent} onChange={(e) => setUseAccent(e.target.checked)} />
        <span>Use this accent for every panel <small className="ui-meta">otherwise each panel keeps its own</small></span></label>
      {confirm ? (
        <div className="ui-actions" role="group" aria-label="Confirm apply">
          <span>Overwrite the active view of {registry.length} panels?</span>
          <button type="button" className="ui-btn primary" onClick={apply}>Yes, apply</button>
          <button type="button" className="ui-btn" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <div className="ui-actions">
          <button type="button" className="ui-btn" disabled={!ready} onClick={() => setConfirm(true)}>Apply to all panels</button>
        </div>
      )}
      {note && <p className="ui-meta" role="status">{note}</p>}
    </section>
  );
}
