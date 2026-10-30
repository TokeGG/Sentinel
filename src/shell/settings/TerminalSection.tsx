// Settings > Terminal home: prompt text, aliases, which boxes show and in what order, world clocks.
import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { Row } from "../../ui/kit";
import { DESK_CHANGED } from "../desk/store";
import { aliasText, parseAliases, validZone, type TermBox, type TermPrefs } from "../desk/termPrefs";
import { loadTermPrefs, saveTermPrefs } from "../desk/useTermPrefs";
import { Head, Switch } from "./Switch";

const LABEL: Record<TermBox, string> = { today: "Today", feed: "Feed", counts: "Unread counts", clocks: "World clocks", timers: "Timers", apps: "App list" };

export function TerminalSection({ onError }: { onError(e: unknown): void }) {
  const [p, setP] = useState<TermPrefs | null>(null);
  useEffect(() => { loadTermPrefs().then(setP).catch(onError); }, []);
  if (!p) return null;
  const save = (next: TermPrefs) => saveTermPrefs(next).then(() => { setP(next); return emit(DESK_CHANGED); }).catch(onError);
  const move = (b: TermBox, d: -1 | 1) => {
    const o = [...p.order], i = o.indexOf(b), j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    save({ ...p, order: o });
  };
  return (
    <section className="st-section" aria-label="Terminal home">
      <Head>Terminal home</Head>
      <Row><label className="st-switch">Prompt text<input id="term-prompt" className="st-input" defaultValue={p.prompt} onBlur={(e) => save({ ...p, prompt: e.target.value })} /></label></Row>
      <Row><label className="st-switch">Aliases (a=open mail, y=open youtube)<input id="term-aliases" className="st-input" defaultValue={aliasText(p.aliases)} onBlur={(e) => save({ ...p, aliases: parseAliases(e.target.value) })} /></label></Row>
      <Row><label className="st-switch">World clocks (e.g. Europe/London, Asia/Tokyo)<input id="term-clocks" className="st-input" defaultValue={p.clocks.join(", ")}
        onBlur={(e) => save({ ...p, clocks: e.target.value.split(",").map((z) => z.trim()).filter(validZone) })} /></label></Row>
      {p.order.map((b) => (
        <Row key={b} end={<span><button type="button" className="ui-btn" aria-label={`Move ${LABEL[b]} up`} onClick={() => move(b, -1)}>↑</button> <button type="button" className="ui-btn" aria-label={`Move ${LABEL[b]} down`} onClick={() => move(b, 1)}>↓</button></span>}>
          <Switch checked={!p.hidden.includes(b)} onChange={(on) => save({ ...p, hidden: on ? p.hidden.filter((h) => h !== b) : [...p.hidden, b] })}>{LABEL[b]}</Switch>
        </Row>
      ))}
    </section>
  );
}
