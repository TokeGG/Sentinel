// Built-in palette providers: panels, module quick actions, shell commands,
// settings toggles and module content (manifest `search`, else load() titles).
// Generic over the registry: no module-specific branches.
import { registry, type ModuleManifest, type SearchHit } from "../../core/module";
import { registerSearchProvider, type Hit } from "../../core/search/registry";
import { rowsToHits } from "../../core/search/rowHits";
import { saveNotifMoons, saveOrbitMotion, saveStarMotion, notifySettingsChanged, type SettingKey } from "../generalSettings";
import { getNotifMoons, getOrbitMotion, getStarMotion } from "../layoutStore";
import { BRIEFING_ID, HELP_ID, CAPTURE_ID } from "./ids";
import { PRESET_NAMES } from "./namedLayouts";
import { TILE_PRESETS } from "./snap";
import { getFlag, getLayouts, setFlag, DESK_CHANGED } from "./store";
import { sendCmd } from "./shellCmd";
import { emit } from "@tauri-apps/api/event";

const open = (id: string) => () => sendCmd({ type: "open", id });

function panelHits(): Hit[] {
  const extra: [string, string][] = [["hub.settings", "Settings"], ["hub.master", "Master Hub (missed notifications)"], [BRIEFING_ID, "Daily briefing"], [HELP_ID, "Help: every module explained"], [CAPTURE_ID, "Quick capture note"]];
  return [
    ...registry.map((m) => ({ key: `panel:${m.id}`, title: `Open ${m.name}`, subtitle: m.description, kind: "panel" as const, run: open(m.id) })),
    ...extra.map(([id, t]) => ({ key: `panel:${id}`, title: `Open ${t}`, kind: "panel" as const, run: open(id) })),
  ];
}

function skillHits(): Hit[] {
  return registry.flatMap((m) => (m.actions ?? []).map((a) => ({
    key: `skill:${m.id}:${a.skill}`, title: `${m.name}: ${a.label}`, kind: "skill" as const,
    run: () => m.skills.find((s) => s.name === a.skill)?.run(),
  })));
}

async function commandHits(): Promise<Hit[]> {
  const names = [...new Set([...PRESET_NAMES, ...Object.keys(await getLayouts().catch(() => ({})))])];
  return [
    { key: "cmd:reopen", title: "Reopen last closed panel", subtitle: "Ctrl+Shift+T", kind: "command", run: () => sendCmd({ type: "reopen" }) },
    { key: "cmd:back", title: "Back to previous panel", subtitle: "Alt+Left", kind: "command", run: () => sendCmd({ type: "back" }) },
    { key: "cmd:fwd", title: "Forward to next panel", subtitle: "Alt+Right", kind: "command", run: () => sendCmd({ type: "forward" }) },
    { key: "cmd:home", title: "Show home", subtitle: "Ctrl+Space: hide every panel, press again to bring them back", kind: "command", run: () => sendCmd({ type: "home" }) },
    { key: "cmd:focus", title: "Toggle focus mode", subtitle: "Ctrl+Shift+F: hide all but the active panel", kind: "command", run: () => sendCmd({ type: "focusMode" }) },
    { key: "cmd:pin", title: "Pin / unpin active panel on top", kind: "command", run: () => sendCmd({ type: "pin" }) },
    { key: "cmd:game", title: "Toggle game mode", kind: "command", run: () => sendCmd({ type: "gameMode" }) },
    { key: "cmd:mon", title: "Move Sentinel to next monitor", kind: "command", run: () => sendCmd({ type: "nextMonitor" }) },
    ...TILE_PRESETS.map((p) => ({ key: `cmd:tile:${p}`, title: `Tile panels: ${p}`, kind: "command" as const, run: () => sendCmd({ type: "tile", preset: p }) })),
    ...names.flatMap((n) => [
      { key: `cmd:layout:${n}`, title: `Switch to layout "${n}"`, kind: "command" as const, run: () => sendCmd({ type: "layout", name: n }) },
      { key: `cmd:save:${n}`, title: `Save current panels as layout "${n}"`, kind: "command" as const, run: () => sendCmd({ type: "saveLayout", name: n }) },
    ]),
  ];
}

type Toggle = [string, () => Promise<boolean>, (on: boolean) => Promise<void>];
function settingHits(): Hit[] {
  const gen = (k: SettingKey, save: (on: boolean) => Promise<void>) => async (on: boolean) => { await save(on); await notifySettingsChanged(k); };
  const desk = (k: "notif_toasts" | "sky_clock" | "ambient_audio") => async (on: boolean) => { await setFlag(k, on); await emit(DESK_CHANGED); };
  const t: Toggle[] = [
    ["Star motion", getStarMotion, gen("star_motion", saveStarMotion)],
    ["Orbit motion", getOrbitMotion, gen("orbit_motion", saveOrbitMotion)],
    ["Notification moons", getNotifMoons, gen("notif_moons", saveNotifMoons)],
    ["Windows toasts (counts only)", () => getFlag("notif_toasts"), desk("notif_toasts")],
    ["Day/night sky", () => getFlag("sky_clock"), desk("sky_clock")],
    ["Ambient audio", () => getFlag("ambient_audio"), desk("ambient_audio")],
  ];
  return t.map(([label, get, set]) => ({ key: `set:${label}`, title: `Toggle ${label}`, kind: "setting" as const, run: async () => set(!(await get())) }));
}

// Content: one snapshot per palette session (cleared by resetContent) so typing never refetches.
let snap: Map<string, Promise<SearchHit[]>> | null = null;
export const resetContent = () => { snap = null; };
const contentOf = (m: ModuleManifest, q: string): Promise<SearchHit[]> => {
  if (m.search) return m.search(q);
  snap ??= new Map();
  if (!snap.has(m.id)) snap.set(m.id, (m.load ? m.load() : Promise.resolve([])).then((r) => rowsToHits(r)).catch(() => []));
  return snap.get(m.id)!;
};
async function contentHits(q: string): Promise<Hit[]> {
  if (q.trim().length < 2) return [];
  const per = await Promise.all(registry.filter((m) => m.search || m.load).map(async (m) =>
    (await contentOf(m, q).catch(() => [])).map((h, i) => ({ key: `c:${m.id}:${h.id ?? i}`, title: h.title, subtitle: `${m.name}${h.subtitle ? ` - ${h.subtitle}` : ""}`, kind: "content" as const, run: open(m.id) }))));
  return per.flat();
}

let done = false;
export function registerBuiltins() {
  if (done) return;
  done = true;
  registerSearchProvider({ id: "panels", label: "Panels", search: panelHits });
  registerSearchProvider({ id: "skills", label: "Actions", search: skillHits });
  registerSearchProvider({ id: "commands", label: "Commands", search: commandHits });
  registerSearchProvider({ id: "settings", label: "Settings", search: settingHits });
  registerSearchProvider({ id: "content", label: "Content", search: contentHits });
}
