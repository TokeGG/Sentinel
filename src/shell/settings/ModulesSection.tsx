// Settings > Modules: generic per-module settings generated from each manifest (core/modSettings.ts):
// Ask bar, link mode, notifications (notif_dnd), taste (taste_off), plus the saved-view fields below.
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { registry } from "../../core/module";
import { categoryOf } from "../../core/categories";
import { DEFAULT_MOD_SETTINGS, genericFields, type LinkMode, type ModSettings } from "../../core/modSettings";
import { isOff, setOff } from "../../core/taste/store";
import { Row } from "../../ui/kit";
import { loadModSettings, MOD_SETTINGS_CHANGED, saveModSettings } from "../../ui/useModSettings";
import { loadPrefs, savePrefs } from "../notifDb";
import { Head, Switch } from "./Switch";
import { getSetting, setSetting } from "../../ui/appSetting";
import { parsePins } from "../TitleExtras";
import { DESK_CHANGED } from "../desk/store";
import { ModuleViewFields } from "./ModuleViewFields";

export function ModulesSection({ onError }: { onError(e: unknown): void }) {
  const mods = [...registry].sort((a, b) => a.name.localeCompare(b.name));
  const [id, setId] = useState(mods[0]?.id ?? "");
  const m = mods.find((x) => x.id === id);
  const [ms, setMs] = useState<ModSettings>(DEFAULT_MOD_SETTINGS);
  const [notif, setNotif] = useState(true);
  const [taste, setTaste] = useState(true);
  const [pins, setPinsState] = useState<string[]>([]);
  useEffect(() => {
    if (!id) return;
    loadModSettings(id).then(setMs, onError);
    loadPrefs().then((p) => setNotif(!p.dnd.includes(id)), onError);
    isOff(id).then((off) => setTaste(!off), () => setTaste(true));
    getSetting("title_pins").then((s) => setPinsState(parsePins(s)), onError);
  }, [id]);
  if (!m) return null;
  const f = genericFields(m);
  const saveMs = (next: ModSettings) => {
    setMs(next);
    saveModSettings(id, next).then(() => emit(MOD_SETTINGS_CHANGED, { id })).catch(onError);
  };
  const onNotif = async (on: boolean) => {
    try {
      const p = await loadPrefs();
      const dnd = on ? p.dnd.filter((x) => x !== id) : [...new Set([...p.dnd, id])];
      await savePrefs({ ...p, dnd }, ["dnd"]);
      setNotif(on);
    } catch (e) { onError(e); }
  };
  const onPin = (on: boolean) => {
    const next = on ? [...new Set([...pins, id])].slice(0, 6) : pins.filter((x) => x !== id);
    setSetting("title_pins", JSON.stringify(next)).then(() => { setPinsState(next); return emit(DESK_CHANGED); }).catch(onError);
  };
  const onTaste = (on: boolean) => setOff(id, !on).then(() => setTaste(on), onError);
  return (
    <section className="st-section" aria-label="Modules">
      <Head>Modules</Head>
      <Row>
        <label className="st-switch">Module
          <select className="st-input" value={id} onChange={(e) => setId(e.target.value)} aria-label="Module">
            {mods.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <small className="ui-meta">category: {categoryOf(m)}</small>
      </Row>
      {f.includes("assist") && <Row><Switch checked={ms.assist} onChange={(assist) => saveMs({ ...ms, assist })}>
        Ask bar <small className="ui-meta">local-model assistant under the panel</small></Switch></Row>}
      {f.includes("links") && <Row><label className="st-switch">Links open in
        <select className="st-input" value={ms.links} onChange={(e) => saveMs({ ...ms, links: e.target.value as LinkMode })} aria-label="Links open in">
          <option value="default">app default</option><option value="app">in-app browser</option><option value="system">system browser</option>
        </select></label></Row>}
      {f.includes("notifications") && <Row><Switch checked={notif} onChange={(v) => void onNotif(v)}>
        Notifications <small className="ui-meta">moons and counts for this module</small></Switch></Row>}
      {f.includes("taste") && <Row><Switch checked={taste} onChange={onTaste}>
        Taste <small className="ui-meta">learn from likes/dislikes to order items</small></Switch></Row>}
      {m.badge && <Row><Switch checked={pins.includes(id)} onChange={onPin}>Pin count to title bar <small className="ui-meta">up to 6 modules</small></Switch></Row>}
      <ModuleViewFields key={id} m={m} fields={f} onError={onError} />
    </section>
  );
}
