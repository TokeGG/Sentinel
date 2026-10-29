// Module-declared options (manifest.customize.options): toggle/select/number.
// Values are re-clamped by mergeView inside cz.setView.
import type { ModuleManifest, OptionDef } from "../../core/module";
import type { Customize } from "../useCustomize";

export function DrawerOptions({ module: m, cz }: { module: ModuleManifest; cz: Customize }) {
  const opts = m.customize?.options ?? [];
  if (opts.length === 0) return null;
  const v = cz.view;
  const set = (key: string, val: boolean | string | number) =>
    void cz.setView({ ...v, options: { ...v.options, [key]: val } });
  return (
    <section className="cz-sec" aria-labelledby="cz-opts">
      <h3 id="cz-opts">Options</h3>
      {opts.map((o) => (
        <Option key={o.key} o={o} value={v.options[o.key]} set={(val) => set(o.key, val)} />
      ))}
    </section>
  );
}

function Option({ o, value, set }: { o: OptionDef; value: unknown; set(v: boolean | string | number): void }) {
  if (o.type === "toggle") {
    return (
      <label className="cz-field cz-check">
        <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} />
        <span>{o.label}</span>
      </label>
    );
  }
  if (o.type === "select") {
    return (
      <label className="cz-field">
        <span>{o.label}</span>
        <select value={String(value)} onChange={(e) => set(e.target.value)}>
          {(o.choices ?? []).map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="cz-field">
      <span>{o.label}</span>
      <input
        type="number"
        min={o.min}
        max={o.max}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) set(n);
        }}
      />
    </label>
  );
}
