// Settings > Panels: title bar style, rebindable shortcuts, per-module view
// (zoom, opacity, lock, remember scroll, always on top), smart folders, groups.
import { useState } from "react";
import { registry } from "../../core/module";
import { Row } from "../../ui/kit";
import { ACTIONS, effective, rebind } from "../desk/keymapUser";
import { TITLE_STYLES } from "../desk/look";
import { cleanView, sanitizeViews, viewOf } from "../desk/panelView";
import { parseIds, sanitizeFolders, sanitizeGroups } from "../desk/collections";
import { getPins, setPins } from "../desk/store";
import { Head, Switch } from "./Switch";
import { useJsonSetting, useTextSetting } from "./useJsonSetting";
import { NamedMap } from "./NamedMap";

export function PanelsSection({ onError }: { onError(e: unknown): void }) {
  const [title, setTitle] = useTextSetting("titlebar_style", onError);
  const [keys, setKeys] = useJsonSetting("keymap", effective, onError);
  const [views, setViews] = useJsonSetting("panel_view_prefs", sanitizeViews, onError);
  const [folders, setFolders] = useJsonSetting("smart_folders", sanitizeFolders, onError);
  const [groups, setGroups] = useJsonSetting("panel_groups", sanitizeGroups, onError);
  const [mod, setMod] = useState(registry[0]?.id ?? "");
  const [pinned, setPinned] = useState<boolean | null>(null);
  const v = viewOf(views, mod);
  const setV = (patch: Partial<typeof v>) => setViews({ ...views, [mod]: cleanView({ ...v, ...patch }) });
  const loadPin = (id: string) => getPins().then((p) => setPinned(p.includes(id))).catch(onError);
  if (pinned === null && mod) void loadPin(mod);
  const bind = (a: string, combo: string) => {
    const r = rebind(keys, a, combo);
    if ("error" in r) onError(new Error(r.error)); else setKeys(r.map);
  };
  return (
    <section className="st-section" aria-label="Panels">
      <Head>Panels</Head>
      <Row><label className="st-switch">Title bar
        <select value={title || "normal"} onChange={(e) => setTitle(e.target.value)}>{TITLE_STYLES.map((t) => <option key={t}>{t}</option>)}</select></label></Row>
      <h3 className="ui-meta">Shortcuts (empty = off; conflicts are refused)</h3>
      {Object.entries(ACTIONS).map(([a, x]) => (
        <Row key={a}><label className="st-switch">{x.label}
          <input className="st-input" key={keys[a]} defaultValue={keys[a]} placeholder="off" onBlur={(e) => e.target.value !== keys[a] && bind(a, e.target.value)} /></label></Row>
      ))}
      <Row end={<button type="button" className="ui-btn" onClick={() => setKeys(effective(null))}>Reset shortcuts</button>}>Defaults</Row>
      <h3 className="ui-meta">Per-module view (Ctrl+= / Ctrl+- / Ctrl+0 inside a panel also zoom)</h3>
      <Row><label className="st-switch">Module
        <select value={mod} onChange={(e) => { setMod(e.target.value); void loadPin(e.target.value); }}>{registry.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></Row>
      <Row><label className="st-switch">Zoom {Math.round(v.zoom * 100)}%
        <input type="range" min={50} max={200} step={10} value={v.zoom * 100} onChange={(e) => setV({ zoom: Number(e.target.value) / 100 })} /></label></Row>
      <Row><label className="st-switch">Content opacity {Math.round(v.opacity * 100)}%
        <input type="range" min={30} max={100} step={5} value={v.opacity * 100} onChange={(e) => setV({ opacity: Number(e.target.value) / 100 })} /></label></Row>
      <Row><Switch checked={v.lock} onChange={(on) => setV({ lock: on })}>Lock position and size</Switch></Row>
      <Row><Switch checked={v.keepScroll} onChange={(on) => setV({ keepScroll: on })}>Remember scroll position</Switch></Row>
      <Row><Switch checked={!!pinned} onChange={(on) => getPins().then((p) => setPins(on ? [...p, mod] : p.filter((x) => x !== mod))).then(() => setPinned(on)).catch(onError)}>Always on top (pin)</Switch></Row>
      <NamedMap title="Smart folders (saved searches; palette or Terminal: folder <name>)" value={folders} placeholder="search words"
        show={(q) => q} parse={(s) => s.trim() || null} onChange={setFolders} />
      <NamedMap title="Panel groups / workspaces (open together; Terminal: group <name>)" value={groups} placeholder="hub.notes, hub.calendar"
        show={(ids) => ids.join(", ")} parse={(s) => { const ids = parseIds(s); return ids.length ? ids : null; }} onChange={setGroups} />
    </section>
  );
}
