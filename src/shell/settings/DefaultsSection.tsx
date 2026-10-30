// Settings > Defaults: how many items the briefing, Terminal home, palette and terminal log show.
import { Row } from "../../ui/kit";
import { sanitizeUi, UI_DEFAULTS_KEY, UI_LIMITS, type UiDefaults } from "../desk/uiDefaults";
import { Head } from "./Switch";
import { useJsonSetting } from "./useJsonSetting";

const LABEL: Record<keyof UiDefaults, string> = {
  briefingRows: "Items per briefing section",
  terminalRows: "Items in Terminal home Today / Feed boxes",
  paletteResults: "Ctrl+K palette results",
  terminalLog: "Terminal output lines kept",
};

export function DefaultsSection({ onError }: { onError(e: unknown): void }) {
  const [v, save] = useJsonSetting(UI_DEFAULTS_KEY, sanitizeUi, onError);
  return (
    <section className="st-section" aria-label="Defaults">
      <Head>Defaults</Head>
      {(Object.keys(LABEL) as (keyof UiDefaults)[]).map((k) => (
        <Row key={k}><label className="st-switch">{LABEL[k]}
          <input type="number" className="st-input" min={UI_LIMITS[k][0]} max={UI_LIMITS[k][1]} defaultValue={v[k]} key={v[k]} aria-label={LABEL[k]}
            onBlur={(e) => save({ ...v, [k]: Number(e.target.value) })} /></label></Row>
      ))}
    </section>
  );
}
