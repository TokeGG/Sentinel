// Settings > Terminal home: prompt text, aliases, which boxes show and in what order, world clocks.
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Row } from "../../ui/kit";
import { DESK_CHANGED } from "../desk/store";
import { aliasText, parseAliases, validZone, type TermPrefs } from "../desk/termPrefs";
import { loadTermPrefs, saveTermPrefs } from "../desk/useTermPrefs";
import { Head } from "./Switch";
import { setSetting } from "../../ui/appSetting";


export function TerminalSection({ onError }: { onError(e: unknown): void }) {
  const [p, setP] = useState<TermPrefs | null>(null);
  useEffect(() => { loadTermPrefs().then(setP).catch(onError); }, []);
  if (!p) return null;
  const save = (next: TermPrefs) => saveTermPrefs(next).then(() => { setP(next); return emit(DESK_CHANGED); }).catch(onError);
  return (
    <section className="st-section" aria-label="Terminal home">
      <Head>Terminal home</Head>
      <Row><label className="st-switch">Prompt text<input id="term-prompt" className="st-input" defaultValue={p.prompt} onBlur={(e) => save({ ...p, prompt: e.target.value })} /></label></Row>
      <Row><label className="st-switch">Aliases (a=open mail, y=open youtube)<input id="term-aliases" className="st-input" defaultValue={aliasText(p.aliases)} onBlur={(e) => save({ ...p, aliases: parseAliases(e.target.value) })} /></label></Row>
      <Row><label className="st-switch">World clocks (e.g. Europe/London, Asia/Tokyo)<input id="term-clocks" className="st-input" defaultValue={p.clocks.join(", ")}
        onBlur={(e) => save({ ...p, clocks: e.target.value.split(",").map((z) => z.trim()).filter(validZone) })} /></label></Row>
      <Row end={<button type="button" className="ui-btn" onClick={() => void setSetting("home_widgets", "").then(() => emit(DESK_CHANGED)).catch(onError)}>Reset widgets</button>}>
        Widgets: drag them on the home screen (title bar moves, corner resizes, x unpins); pin more from the tray at the bottom. Reset applies next start.</Row>
    </section>
  );
}
