// Settings > Privacy: presentation mode, hidden counts, incognito, history auto-clear, backup reminder.
import { registry } from "../../core/module";
import { Row } from "../../ui/kit";
import { Head, Switch } from "./Switch";
import { NumField, useSys } from "../privacy/fields";

export function PrivacySection({ onError }: { onError(e: unknown): void }) {
  const [p, set] = useSys(onError);
  if (!p) return null;
  const togglePanel = (id: string, on: boolean) =>
    set({ presentationPanels: on ? [...p.presentationPanels, id] : p.presentationPanels.filter((x) => x !== id) });
  return (
    <section className="st-section" aria-label="Privacy">
      <Head>Privacy</Head>
      <Row><Switch checked={p.presentation} onChange={(v) => set({ presentation: v })}>
        Presentation mode <small className="ui-meta">for screen sharing: closes the panels ticked below and hides title-bar counts</small></Switch></Row>
      <details><summary className="ui-meta">Panels to close in presentation mode ({p.presentationPanels.length})</summary>
        {registry.map((m) => (
          <Row key={m.id}><Switch checked={p.presentationPanels.includes(m.id)} onChange={(v) => togglePanel(m.id, v)}>{m.name}</Switch></Row>
        ))}
      </details>
      <Row><Switch checked={p.hideCounts} onChange={(v) => set({ hideCounts: v })}>Hide counts on the title bar</Switch></Row>
      <Row><Switch checked={p.incognito} onChange={(v) => set({ incognito: v })}>
        Incognito session <small className="ui-meta">no activity-log writes until Sentinel restarts</small></Switch></Row>
      <Row><NumField label="Auto-clear history older than" value={p.autoClearDays} min={0} max={3650} unit="days"
        hint="0 = off. Runs once at startup: activity log, notification history, browser and YouTube history." onSave={(n) => set({ autoClearDays: n })} /></Row>
      <Row><NumField label="Backup reminder every" value={p.backupRemindDays} min={0} max={365} unit="days"
        hint="0 = off. Shows a moon on Backup when the last backup is older." onSave={(n) => set({ backupRemindDays: n })} /></Row>
    </section>
  );
}
