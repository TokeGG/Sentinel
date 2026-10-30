// Title-bar extras: global do-not-disturb countdown button and pinned module counts
// (app_settings `title_pins`, Settings > Desktop). Counts only, never message text.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { registry } from "../core/module";
import { getSetting } from "../ui/appSetting";
import { getShown, subscribeShown } from "./notifStore";
import { dndLabel, nextDnd } from "./notifLogic";
import { loadPrefs, NOTIF_PREFS_CHANGED, savePrefs } from "./notifDb";
import { openById } from "./desk/layoutOps";
import { DESK_CHANGED } from "./desk/store";

export const parsePins = (s: string | null): string[] => { try { const v = JSON.parse(s ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : []; } catch { return []; } };

export function DndButton({ onError }: { onError: (e: string) => void }) {
  const [all, setAll] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const load = () => loadPrefs().then((p) => setAll(p.all)).catch(() => {});
    load();
    const un = listen(NOTIF_PREFS_CHANGED, load);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(t); void un.then((f) => f()); };
  }, []);
  const label = dndLabel(all, now);
  const click = async () => {
    try { const p = await loadPrefs(); p.all = nextDnd(p.all, new Date()); await savePrefs(p, ["all"]); setAll(p.all); setNow(Date.now()); }
    catch (e) { onError(String(e)); }
  };
  return <button className={`titlebar-dnd${label ? " on" : ""}`} title="Do not disturb (click to cycle 30m / 1h / 2h / until 8:00 / off)" aria-label={label ? `Do not disturb, ${label} left` : "Do not disturb off"} onClick={click}>{label ? `DND ${label}` : "DND"}</button>;
}

export function PinnedCounts({ onError }: { onError: (e: string) => void }) {
  const [pins, setPins] = useState<string[]>([]);
  const [shown, setShown] = useState(getShown());
  useEffect(() => {
    const load = () => getSetting("title_pins").then((s) => setPins(parsePins(s))).catch(() => {});
    load();
    const un = listen(DESK_CHANGED, load);
    const off = subscribeShown(() => setShown(getShown()));
    return () => { off(); void un.then((f) => f()); };
  }, []);
  return <>{pins.map((id) => {
    const m = registry.find((x) => x.id === id);
    return m ? <button key={id} className="titlebar-chip" onClick={() => openById(id).catch((e) => onError(String(e)))}>{m.name} <b>{shown[id] ?? 0}</b></button> : null;
  })}</>;
}
