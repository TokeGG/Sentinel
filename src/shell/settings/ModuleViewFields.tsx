// The saved-view part of Settings > Modules: default view, density, refresh and the manifest's own
// customize options, written to the module's active view in panel_prefs (applies when the panel reopens).
import { useEffect, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { REFRESH_CHOICES, refreshLabel, type GenericField } from "../../core/modSettings";
import type { View } from "../../ui/prefs";
import { loadViews, saveView, setActiveView } from "../../ui/prefsStore";
import { Row } from "../../ui/kit";
import { Switch } from "./Switch";

export function ModuleViewFields({ m, fields, onError }: { m: ModuleManifest; fields: GenericField[]; onError(e: unknown): void }) {
  const [views, setViews] = useState<View[]>([]);
  const [active, setActive] = useState("");
  useEffect(() => { loadViews(m.id, m.customize).then((r) => { setViews(r.views); setActive(r.active); }, onError); }, [m.id]);
  const v = views.find((x) => x.name === active);
  if (!v) return null;
  const put = (next: View) => {
    setViews((vs) => vs.map((x) => (x.name === next.name ? next : x)));
    saveView(m.id, next).catch(onError);
  };
  const pick = (name: string) => { setActive(name); setActiveView(m.id, name).catch(onError); };
  return (
    <>
      {fields.includes("defaultView") && views.length > 1 && <Row><label className="st-switch">Default view
        <select className="st-input" value={active} onChange={(e) => pick(e.target.value)} aria-label="Default view">
          {views.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
        </select></label></Row>}
      {fields.includes("density") && <Row><label className="st-switch">Density
        <select className="st-input" value={v.density} onChange={(e) => put({ ...v, density: e.target.value as View["density"] })} aria-label="Density">
          <option value="compact">compact</option><option value="roomy">roomy</option>
        </select></label></Row>}
      {fields.includes("refresh") && <Row><label className="st-switch">Refresh while open
        <select className="st-input" value={String(v.refreshMinutes)} aria-label="Refresh interval"
          onChange={(e) => put({ ...v, refreshMinutes: e.target.value === "null" ? null : Number(e.target.value) })}>
          {REFRESH_CHOICES.map((n) => <option key={String(n)} value={String(n)}>{refreshLabel(n)}</option>)}
        </select></label></Row>}
      {(m.customize?.options ?? []).map((o) => {
        const cur = v.options[o.key] ?? o.default;
        const set = (val: boolean | string | number) => put({ ...v, options: { ...v.options, [o.key]: val } });
        if (o.type === "toggle") return <Row key={o.key}><Switch checked={!!cur} onChange={set}>{o.label}</Switch></Row>;
        if (o.type === "select") return <Row key={o.key}><label className="st-switch">{o.label}
          <select className="st-input" value={String(cur)} onChange={(e) => set(e.target.value)} aria-label={o.label}>
            {(o.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label></Row>;
        return <Row key={o.key}><label className="st-switch">{o.label}
          <input className="st-input" type="number" min={o.min} max={o.max} value={Number(cur)} aria-label={o.label}
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) set(Math.min(o.max ?? n, Math.max(o.min ?? n, n))); }} />
        </label></Row>;
      })}
      {(m.customize?.sections?.length ?? 0) > 0 && <small className="ui-meta">Sections: show, hide and reorder from the panel's gear.</small>}
    </>
  );
}
