// "Tune" drawer: what this module learned, delete a feature, reset, or turn learning off.
import { topFeatures } from "../core/taste/model";
import type { Taste } from "../core/taste/useTaste";
import { ConfirmButton } from "./ConfirmButton";
import "./taste.css";

function List({ title, items, taste }: { title: string; items: ReturnType<typeof topFeatures>; taste: Taste }) {
  return (
    <section className="cz-sec">
      <h3>{title}</h3>
      {items.length === 0 && <p className="ui-meta">Nothing yet.</p>}
      {items.map((x) => (
        <div key={x.feature} className="ts-feat">
          <span>{x.label}</span>
          <button type="button" className="ui-btn ui-sm" aria-label={`Forget ${x.label}`} onClick={() => void taste.forget(x.feature)}>×</button>
        </div>
      ))}
    </section>
  );
}

export function TasteDrawer({ taste, name, onClose }: { taste: Taste; name: string; onClose(): void }) {
  return (
    <>
      <div className="cz-backdrop" onClick={onClose} />
      <aside className="cz-drawer" role="dialog" aria-modal="true" aria-label={`Tune ${name}`}>
        <header className="cz-head">
          <h2>Tune {name}</h2>
          <button type="button" className="cz-x" aria-label="Close tune" onClick={onClose}>×</button>
        </header>
        <p className="ui-meta">Learned only on this PC from your 👍 👎 and opens. Never sent anywhere.</p>
        <label className="cz-field cz-check">
          <input type="checkbox" checked={taste.off} onChange={(e) => void taste.setOff(e.target.checked)} />
          <span>Turn learning off</span>
        </label>
        <List title="You like" items={topFeatures(taste.profile, 1)} taste={taste} />
        <List title="You skip" items={topFeatures(taste.profile, -1)} taste={taste} />
        <ConfirmButton label="Reset everything learned" onConfirm={() => void taste.reset()} />
      </aside>
    </>
  );
}
