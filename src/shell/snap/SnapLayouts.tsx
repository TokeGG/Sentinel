// hub.snap: Snap Layouts picker for one panel (target from localStorage `snap_target`,
// written by the main window). Pick a zone -> the panel goes there; then Snap Assist
// offers the other open panels for the remaining zones.
import { useEffect, useState } from "react";
import { registry } from "../../core/module";
import { closePanel, mainClientRect } from "../panelApi";
import { openPanels } from "../desk/layoutOps";
import { SNAP_ID } from "../desk/ids";
import type { Rect } from "../layout";
import { placeRect } from "./dragSnap";
import { snapPrefsNow } from "./snapPrefs";
import { assistFill, layoutRects, SNAP_LAYOUTS, type SnapLayout } from "./zones";

export const SNAP_TARGET = "snap_target";
const nameOf = (id: string) => registry.find((m) => m.id === id)?.name ?? id;
const readTarget = () => { try { return localStorage.getItem(SNAP_TARGET) ?? ""; } catch { return ""; } };

export function SnapLayouts() {
  const [target, setTarget] = useState(readTarget);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<{ layout: SnapLayout; rects: Rect[]; free: number[]; others: string[] } | null>(null);
  useEffect(() => {
    const on = () => { setTarget(readTarget()); setStep(null); };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  const fail = (e: unknown) => setErr(String(e));
  const pick = async (layout: SnapLayout, zone: number) => {
    const rects = layoutRects(layout, await mainClientRect(), snapPrefsNow().gap);
    await placeRect(target, rects[zone]);
    const others = (await openPanels()).map((p) => p.id).filter((id) => id !== target && id !== SNAP_ID).reverse();
    const free = rects.map((_, i) => i).filter((i) => i !== zone);
    if (!others.length) return closePanel(SNAP_ID);
    setStep({ layout, rects, free, others });
  };
  const put = async (zone: number, id: string) => {
    if (!step) return;
    await placeRect(id, step.rects[zone]);
    const next = { ...step, free: step.free.filter((z) => z !== zone), others: step.others.filter((o) => o !== id) };
    if (!next.free.length || !next.others.length) return closePanel(SNAP_ID);
    setStep(next);
  };
  const fillAll = async () => {
    if (!step) return;
    const placed = step.rects.findIndex((_, i) => !step.free.includes(i));
    for (const a of assistFill(step.rects.length, placed, step.others)) if (step.free.includes(a.zone)) await placeRect(a.id, step.rects[a.zone]);
    await closePanel(SNAP_ID);
  };
  if (!target) return <p className="ui-meta">Open Snap Layouts from a panel's ▦ button or Ctrl+Alt+Z.</p>;
  return (
    <div className="snap-picker">
      <p className="ui-meta">{step ? "Snap Assist: choose a panel for each empty zone" : `Place ${nameOf(target)}`}</p>
      {err && <p className="ui-meta" style={{ color: "var(--bad)" }}>{err}</p>}
      {!step && <div className="snap-layouts">{SNAP_LAYOUTS.map((l) => (
        <div key={l.id} className="snap-thumb" title={l.name}>{l.zones.map((z, i) => (
          <button key={i} aria-label={`${l.name} zone ${i + 1}`} style={{ left: `${z[0] * 100}%`, top: `${z[1] * 100}%`, width: `${z[2] * 100}%`, height: `${z[3] * 100}%` }}
            onClick={() => pick(l, i).catch(fail)} />))}</div>))}</div>}
      {step && <>
        {step.free.map((z) => (
          <div key={z} className="snap-assist-row"><span>Zone {z + 1}</span>
            {step.others.map((id) => <button key={id} className="ui-btn" onClick={() => put(z, id).catch(fail)}>{nameOf(id)}</button>)}</div>))}
        <button className="ui-btn" onClick={() => fillAll().catch(fail)}>Fill automatically</button>{" "}
        <button className="ui-btn" onClick={() => closePanel(SNAP_ID).catch(fail)}>Done</button>
      </>}
    </div>
  );
}
