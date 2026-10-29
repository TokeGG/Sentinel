// Shell options every panel gets: accent, density, font size, background
// tint, refresh interval. Each change goes through cz.setView (mergeView).
import type { Customize } from "../useCustomize";

const HEX = /^#[0-9a-f]{6}$/i;
const REFRESH = [1, 5, 15, 60];

export function DrawerAppearance({ cz }: { cz: Customize }) {
  const v = cz.view;
  const set = (patch: Partial<typeof v>) => void cz.setView({ ...v, ...patch });
  const refresh = v.refreshMinutes;
  const choices = refresh && !REFRESH.includes(refresh) ? [...REFRESH, refresh].sort((a, b) => a - b) : REFRESH;
  return (
    <section className="cz-sec" aria-labelledby="cz-look">
      <h3 id="cz-look">Appearance</h3>
      <label className="cz-field">
        <span>Accent</span>
        <input
          type="color"
          value={v.accent}
          onChange={(e) => HEX.test(e.target.value) && set({ accent: e.target.value.toLowerCase() })}
        />
        <code>{v.accent}</code>
      </label>
      <label className="cz-field">
        <span>Density</span>
        <select value={v.density} onChange={(e) => set({ density: e.target.value as typeof v.density })}>
          <option value="roomy">Roomy</option>
          <option value="compact">Compact</option>
        </select>
      </label>
      <label className="cz-field">
        <span>Font size</span>
        <input type="range" min={0.8} max={1.4} step={0.05} value={v.fontScale}
          onChange={(e) => set({ fontScale: Number(e.target.value) })} />
        <code>{Math.round(v.fontScale * 100)}%</code>
      </label>
      <label className="cz-field">
        <span>Background tint</span>
        <input type="range" min={0} max={1} step={0.05} value={v.tint}
          onChange={(e) => set({ tint: Number(e.target.value) })} />
        <code>{Math.round(v.tint * 100)}%</code>
      </label>
      <label className="cz-field">
        <span>Auto-refresh</span>
        <select
          value={refresh ?? ""}
          onChange={(e) => set({ refreshMinutes: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Off</option>
          {choices.map((n) => (
            <option key={n} value={n}>{n} min</option>
          ))}
        </select>
      </label>
      <p className="cz-note">Refresh runs only while this panel is open.</p>
    </section>
  );
}
