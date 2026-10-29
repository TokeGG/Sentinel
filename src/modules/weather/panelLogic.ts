// Pure helpers for the Weather panel. Rows carry temperatures in °C (what
// Open-Meteo returns by default), so the units option is a display conversion.
type Row = Record<string, unknown>;
export type Units = "°C" | "°F";

export const weatherSections = [
  { id: "alerts", label: "Severe alerts" },
  { id: "places", label: "Places" },
  { id: "forecast", label: "5-day forecast" },
  { id: "add", label: "Add place" },
  { id: "actions", label: "Refresh" },
];

export const toF = (c: number) => (c * 9) / 5 + 32;
export const toC = (f: number) => ((f - 32) * 5) / 9;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** "21°C" / "70°F" from a Celsius value; "—" when missing. */
export function tempText(c: unknown, units: Units): string {
  const n = num(c);
  if (n === null) return "—";
  return `${Math.round(units === "°F" ? toF(n) : n)}${units}`;
}

const WMO: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers", 85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorm", 96: "Thunderstorm, hail", 99: "Thunderstorm, heavy hail",
};

export function conditionText(code: unknown): string {
  const n = num(code);
  return n === null ? "—" : (WMO[n] ?? "Unknown");
}

/** The module's severe flag (thunderstorm+ WMO codes); code is a fallback. */
export function isSevere(r: Row): boolean {
  if (typeof r.severe === "boolean") return r.severe;
  return (num(r.code) ?? 0) >= 95;
}

/** Emoji for a WMO code (display only); "" when unknown. */
export function conditionGlyph(code: unknown): string {
  const n = num(code);
  if (n === null) return "";
  if (n === 0 || n === 1) return "☀️";
  if (n === 2) return "⛅";
  if (n === 3) return "☁️";
  if (n === 45 || n === 48) return "🌫️";
  if (n >= 71 && n <= 77) return "❄️";
  if (n === 85 || n === 86) return "❄️";
  if (n >= 95) return "⛈️";
  if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82)) return "🌧️";
  return "";
}

export function placeName(r: Row): string {
  if (typeof r.place === "string" && r.place.trim()) return r.place.trim();
  const t = typeof r.title === "string" ? r.title : "";
  const i = t.lastIndexOf(": ");
  return (i > 0 ? t.slice(0, i) : t).trim();
}

export function severePlaces(rows: Row[]): string[] {
  return rows.filter(isSevere).map(placeName);
}

export function placeView(r: Row, units: Units) {
  const hi = num(r.high_c);
  const lo = num(r.low_c);
  return {
    name: placeName(r),
    temp: tempText(r.temp_c, units),
    condition: conditionText(r.code),
    glyph: conditionGlyph(r.code),
    range: hi !== null && lo !== null ? `H ${tempText(hi, units)} · L ${tempText(lo, units)}` : "",
    severe: isSevere(r),
  };
}
