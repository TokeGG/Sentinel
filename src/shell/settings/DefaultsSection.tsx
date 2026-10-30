// Settings > Defaults: item counts (briefing, Terminal home, palette, terminal log), clock format, temperature unit.
import { Row } from "../../ui/kit";
import { sanitizeUi, UI_DEFAULTS_KEY, UI_LIMITS, type UiCounts } from "../desk/uiDefaults";
import { Head } from "./Switch";
import { useJsonSetting } from "./useJsonSetting";

const LABEL: Record<keyof UiCounts, string> = {
  briefingRows: "Items per briefing section",
  terminalRows: "Items in Terminal home Today / Feed boxes",
  terminalLater: "Items in Terminal home Read later box",
  paletteResults: "Ctrl+K palette results",
  terminalLog: "Terminal output lines kept",
};

export function DefaultsSection({ onError }: { onError(e: unknown): void }) {
  const [v, save] = useJsonSetting(UI_DEFAULTS_KEY, sanitizeUi, onError);
  return (
    <section className="st-section" aria-label="Defaults">
      <Head>Defaults</Head>
      <Row><label className="st-switch">Clock format (Terminal clocks, Calendar, world clocks)
        <select className="ui-select" value={v.clock} aria-label="Clock format" onChange={(e) => save({ ...v, clock: e.target.value === "12h" ? "12h" : "24h" })}>
          <option value="24h">24-hour (14:05)</option><option value="12h">12-hour (2:05 PM)</option>
        </select></label></Row>
      <Row><label className="st-switch">Temperature unit (Weather titles, briefing; the Weather panel option can override)
        <select className="ui-select" value={v.temp} aria-label="Temperature unit" onChange={(e) => save({ ...v, temp: e.target.value === "°F" ? "°F" : "°C" })}>
          <option value="°C">°C</option><option value="°F">°F</option>
        </select></label></Row>
      {(Object.keys(LABEL) as (keyof UiCounts)[]).map((k) => (
        <Row key={k}><label className="st-switch">{LABEL[k]}
          <input type="number" className="st-input" min={UI_LIMITS[k][0]} max={UI_LIMITS[k][1]} defaultValue={v[k]} key={v[k]} aria-label={LABEL[k]}
            onBlur={(e) => save({ ...v, [k]: Number(e.target.value) })} /></label></Row>
      ))}
    </section>
  );
}
