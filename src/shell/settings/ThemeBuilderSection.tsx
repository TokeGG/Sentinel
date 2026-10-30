// Settings > Theme builder: pick colours + font with a live preview; saved as
// app_settings `custom_theme` and used when Desktop > Theme = "custom".
// Seasonal themes (opt-in `seasonal_theme`) override the theme by date.
import { Row } from "../../ui/kit";
import { cleanCustom, customVars, FONTS, seasonOf, type CustomTheme } from "../desk/look";
import { Head, Switch } from "./Switch";
import { useJsonSetting, useTextSetting } from "./useJsonSetting";

const COLORS: [keyof CustomTheme, string][] = [["base", "Background"], ["raised", "Raised"], ["overlay", "Overlay"], ["text", "Text"]];

export function ThemeBuilderSection({ onError }: { onError(e: unknown): void }) {
  const [t, save] = useJsonSetting("custom_theme", cleanCustom, onError);
  const [theme, setTheme] = useTextSetting("theme", onError);
  const [season, setSeason] = useTextSetting("seasonal_theme", onError);
  const preview = customVars(t) as React.CSSProperties;
  return (
    <section className="st-section" aria-label="Theme builder">
      <Head>Theme builder</Head>
      {COLORS.map(([k, label]) => (
        <Row key={k}><label className="st-switch">{label}
          <input type="color" value={t[k]} onChange={(e) => save({ ...t, [k]: e.target.value })} /></label></Row>
      ))}
      <Row><label className="st-switch">Font
        <select value={t.font} onChange={(e) => save({ ...t, font: e.target.value })}>{FONTS.map((f) => <option key={f} value={f}>{f || "Default"}</option>)}</select></label></Row>
      <div style={{ ...preview, background: "var(--base)", color: "var(--text)", fontFamily: "var(--font-body)", padding: "var(--sp-2)", borderRadius: "var(--radius)" }} aria-label="Preview">
        <div style={{ background: "var(--raised)", padding: "var(--sp-2)" }}>Preview: raised card
          <div style={{ background: "var(--overlay)", padding: "var(--sp-1)", marginTop: "var(--sp-1)" }}>Overlay text</div></div>
      </div>
      <Row end={<button type="button" className="ui-btn" disabled={theme === "custom"} onClick={() => setTheme("custom")}>{theme === "custom" ? "In use" : "Use custom theme"}</button>}>Apply</Row>
      <Row><Switch checked={season === "1"} onChange={(on) => setSeason(on ? "1" : "0")}>Seasonal themes (now: {seasonOf(new Date())})</Switch></Row>
    </section>
  );
}
