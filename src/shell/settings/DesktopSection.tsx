// Settings > Desktop: opt-in hotkeys, start with Windows, toasts, theme,
// day/night sky, ambient audio, launch layout, first-run tour. All default off.
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { Row } from "../../ui/kit";
import { normalizeHotkey } from "../desk/desktopLogic";
import { DESK_CHANGED, getDesk, getFlag, getLayouts, setDesk, setFlag, type DeskKey } from "../desk/store";
import { THEMES } from "../desk/theme";
import { Head, Switch } from "./Switch";
import { VoiceRows } from "./VoiceRows";

type Flag = "notif_toasts" | "sky_clock" | "ambient_audio";
const FLAGS: [Flag, string][] = [["notif_toasts", "Windows toasts (counts only, never message text)"], ["sky_clock", "Day/night sky follows the clock"], ["ambient_audio", "Ambient audio (soft noise)"]];

export function DesktopSection({ onError }: { onError(e: unknown): void }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [layouts, setLayoutNames] = useState<string[]>([]);
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => {
    (async () => {
      const f: Record<string, boolean> = {};
      for (const [k] of FLAGS) f[k] = await getFlag(k);
      setFlags(f);
      const t: Record<string, string> = {};
      for (const k of ["hotkey_summon", "hotkey_capture", "theme", "launch_layout", "home_style"] as DeskKey[]) t[k] = await getDesk(k);
      setText(t);
      setLayoutNames(Object.keys(await getLayouts()));
    })().catch(onError);
    isEnabled().then(setAuto).catch(() => setAuto(false));
  }, []);
  const changed = () => emit(DESK_CHANGED);
  const flip = (k: Flag) => async (on: boolean) => { try { await setFlag(k, on); setFlags({ ...flags, [k]: on }); await changed(); } catch (e) { onError(e); } };
  const saveText = async (k: DeskKey, v: string) => {
    try {
      const val = k.startsWith("hotkey") ? normalizeHotkey(v) : v;
      if (val === null) throw new Error(`"${v}" is not a valid hotkey (e.g. Ctrl+Shift+Space)`);
      await setDesk(k, val); setText({ ...text, [k]: val }); await changed();
    } catch (e) { onError(e); }
  };
  const hot = (k: DeskKey, label: string) => (
    <Row><label className="st-switch">{label}
      <input className="st-input" defaultValue={text[k] ?? ""} key={text[k]} placeholder="off (e.g. Ctrl+Shift+Space)" onBlur={(e) => saveText(k, e.target.value)} /></label></Row>
  );
  return (
    <section className="st-section" aria-label="Desktop">
      <Head>Desktop</Head>
      {hot("hotkey_summon", "Global summon/hide hotkey")}
      {hot("hotkey_capture", "Global quick-capture hotkey")}
      <Row><Switch checked={!!auto} disabled={auto === null} onChange={(on) => (on ? enable() : disable()).then(() => setAuto(on)).catch(onError)}>Start with Windows</Switch></Row>
      {FLAGS.map(([k, label]) => <Row key={k}><Switch checked={!!flags[k]} onChange={flip(k)}>{label}</Switch></Row>)}
      <Row><label className="st-switch">Theme
        <select value={text.theme || "default"} onChange={(e) => saveText("theme", e.target.value)}>{Object.keys(THEMES).map((t) => <option key={t}>{t}</option>)}</select></label></Row>
      <Row><label className="st-switch">Home screen
        <select value={text.home_style || "planets"} onChange={(e) => saveText("home_style", e.target.value)}><option value="planets">Planets</option><option value="terminal">Terminal</option></select></label></Row>
      <VoiceRows onError={onError} />
      <Row><label className="st-switch">Launch into layout
        <select value={text.launch_layout ?? ""} onChange={(e) => saveText("launch_layout", e.target.value)}>
          <option value="">Last session</option>{layouts.map((n) => <option key={n}>{n}</option>)}</select></label></Row>
      <Row end={<button type="button" className="ui-btn" onClick={() => setDesk("tour_done", "").then(changed).catch(onError)}>Show tour again</button>}>First-run tour</Row>
    </section>
  );
}
