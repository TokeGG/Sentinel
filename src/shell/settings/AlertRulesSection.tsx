// Settings > Alert rules (app_settings `notif_policy`): per-module sound,
// priority senders/keywords, daily digest, count-only toasts, hourly limit,
// vacation mode and focus sessions.
import { useState } from "react";
import { registry } from "../../core/module";
import { Row } from "../../ui/kit";
import { fmtHM, parseHM } from "../notifLogic";
import { sanitizePolicy, splitList, type Tone } from "../notifPolicy";
import { playTone } from "../desk/alerts";
import { Head, Switch } from "./Switch";
import { useJsonSetting } from "./useJsonSetting";

const TONES: Tone[] = ["off", "chime", "blip", "bell", "low"];
const DAY = 86400_000;

export function AlertRulesSection({ onError }: { onError(e: unknown): void }) {
  const [p, save] = useJsonSetting("notif_policy", sanitizePolicy, onError);
  const [mins, setMins] = useState(60);
  const now = Date.now();
  const set = (patch: Partial<typeof p>) => save({ ...p, ...patch });
  const list = (label: string, v: string[], k: "prioritySenders" | "priorityWords") => (
    <Row><label className="st-switch">{label}
      <input className="st-input" key={v.join()} defaultValue={v.join(", ")} placeholder="comma separated" onBlur={(e) => set({ [k]: splitList(e.target.value) })} /></label></Row>
  );
  return (
    <section className="st-section" aria-label="Alert rules">
      <Head>Alert rules</Head>
      {list("Priority senders (bypass digest/limits)", p.prioritySenders, "prioritySenders")}
      {list("Priority keywords", p.priorityWords, "priorityWords")}
      <Row><Switch checked={p.lockCountOnly} onChange={(on) => set({ lockCountOnly: on })}>Count-only toasts (safe on the lock screen)</Switch></Row>
      <Row><Switch checked={p.digest.on} onChange={(on) => set({ digest: { ...p.digest, on } })}>Daily digest instead of instant toasts</Switch>
        <input className="st-input" key={p.digest.at} defaultValue={fmtHM(p.digest.at)} onBlur={(e) => { const m = parseHM(e.target.value); if (m !== null) set({ digest: { ...p.digest, at: m } }); }} /></Row>
      <Row><label className="st-switch">Max toasts per hour (0 = no limit)
        <input className="st-input" type="number" min={0} max={100} value={p.hourlyLimit} onChange={(e) => set({ hourlyLimit: Number(e.target.value) })} /></label></Row>
      <Row end={p.vacationUntil > now
        ? <button type="button" className="ui-btn" onClick={() => set({ vacationUntil: 0 })}>End vacation</button>
        : <button type="button" className="ui-btn" onClick={() => set({ vacationUntil: now + 7 * DAY })}>Start (7 days)</button>}>
        Vacation mode {p.vacationUntil > now ? `until ${new Date(p.vacationUntil).toLocaleDateString()}` : "(off)"}</Row>
      <Row><label className="st-switch">Focus session: allow only
        <select multiple value={p.focus.allow} onChange={(e) => set({ focus: { ...p.focus, allow: [...e.target.selectedOptions].map((o) => o.value) } })}>
          {registry.map((m) => <option key={m.id} value={m.id.toLowerCase()}>{m.name}</option>)}</select></label></Row>
      <Row end={p.focus.until > now
        ? <button type="button" className="ui-btn" onClick={() => set({ focus: { ...p.focus, until: 0 } })}>Stop focus</button>
        : <><input className="st-input" type="number" min={5} max={600} value={mins} onChange={(e) => setMins(Number(e.target.value))} />
          <button type="button" className="ui-btn" onClick={() => set({ focus: { ...p.focus, until: now + mins * 60_000 } })}>Start focus</button></>}>
        Focus {p.focus.until > now ? `until ${new Date(p.focus.until).toLocaleTimeString()}` : "(off)"}</Row>
      <h3 className="ui-meta">Sound per module (WebAudio tones, no files)</h3>
      {registry.map((m) => (
        <Row key={m.id} end={<button type="button" className="ui-btn ui-sm" onClick={() => playTone(p.sounds[m.id] ?? "off")}>Test</button>}>
          <label className="st-switch">{m.name}
            <select value={p.sounds[m.id] ?? "off"} onChange={(e) => set({ sounds: { ...p.sounds, [m.id]: e.target.value as Tone } })}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></label>
        </Row>
      ))}
    </section>
  );
}
