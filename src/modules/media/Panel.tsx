import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { useOption } from "../../ui/useOption";
import { Images } from "./Images";
import { airsIn } from "./panelLogic";
import type { ShowRow } from "./shows";
import { NowPlayingCard, Sports, TwitchLive } from "./Widgets";
import "./media.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run } = useModule(module);
  const league = useOption<string>("league", "nfl");
  const [name, setName] = useState("");
  const shows = rows as unknown as (ShowRow & { id: string })[];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="md">
      <h2 className="ui-head"><span className="ui-dot" />{module.name}</h2>
      {error && <ErrorLine message={error} />}
      <Sections>
        <Section id="nowplaying"><NowPlayingCard run={run} /></Section>
        <Section id="twitch"><TwitchLive run={run} /></Section>
        <Section id="shows">
          <div className="md-card">
            <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); void run("add_show", { name }).then(() => setName("")); }}>
              <input placeholder="Add a show (TVmaze search)…" value={name} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className="ui-btn primary ui-sm" disabled={busy || !name.trim()}>Add</button>
              <button type="button" className="ui-btn ui-sm" disabled={busy || !name.trim()} onClick={() => void run("add_show", { name, manual: true }).then(() => setName(""))}>Add without lookup</button>
              <button type="button" className="ui-btn ui-sm" disabled={busy} onClick={() => void run("refresh_shows")}>Refresh dates</button>
              <ScheduleToggle module={module} />
            </form>
            {!shows.length && <EmptyState title="No shows tracked" />}
            <ul className="md-list">
              {shows.map((s) => (
                <li key={s.id}>
                  <strong>{s.name}</strong> <span className="md-dim">{s.next_label} · {s.next_day ?? ""} ({airsIn(s.next_day, today)})</span>
                  <input type="date" aria-label={`Next episode of ${s.name}`} value={s.next_day ?? ""} onChange={(e) => void run("set_next", { id: s.id, day: e.target.value })} />
                  <button type="button" className="ui-btn ui-sm" disabled={busy || !s.next_day} onClick={() => void run("show_to_calendar", { id: s.id })}>To calendar</button>
                  <ConfirmButton label="Remove" className="ui-btn ui-sm" disabled={busy} onConfirm={() => void run("remove_show", { id: s.id })} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
        <Section id="images"><Images run={run} /></Section>
        <Section id="sports"><Sports run={run} league={league} /></Section>
      </Sections>
    </div>
  );
}
