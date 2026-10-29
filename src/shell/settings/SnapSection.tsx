// Settings > Window snapping: on/off and the gap between snapped panels.
import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { loadSnapPrefs, saveSnapPrefs } from "../snap/snapPrefs";
import type { SnapPrefs } from "../snap/zones";
import { Head, Switch } from "./Switch";

export function SnapSection({ onError }: { onError(e: unknown): void }) {
  const [p, setP] = useState<SnapPrefs | null>(null);
  useEffect(() => { loadSnapPrefs().then(setP).catch(onError); }, []);
  const save = (n: SnapPrefs) => { setP(n); saveSnapPrefs(n).catch(onError); };
  return (
    <section className="st-section" aria-label="Window snapping">
      <Head>Window snapping</Head>
      <Row><Switch checked={p?.on ?? true} disabled={!p} onChange={(on) => p && save({ ...p, on })}>
        Snap panels <small className="ui-meta">drag to an edge = half, corner = quarter, top = fill; Ctrl+Alt+Z = Snap Layouts</small></Switch></Row>
      <Row><label className="st-switch">Grid gap
        <input type="range" min={0} max={32} step={2} value={p?.gap ?? 8} disabled={!p} aria-label="Grid gap"
          onChange={(e) => p && save({ ...p, gap: Number(e.target.value) })} />
        <output>{p?.gap ?? 8}px</output></label></Row>
    </section>
  );
}
