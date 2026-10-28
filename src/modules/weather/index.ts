import { fetch } from "@tauri-apps/plugin-http";
import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";

// Open-Meteo: free, no API key, no account. Geocoding + forecast + alerts
// all from the same provider — this is why Weather has zero setup cost.
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

interface Location extends Record<string, unknown> {
  id: number;
  label: string;
  lat: number;
  lon: number;
}

async function addLocation(args?: Record<string, unknown>) {
  const query = String(args?.place ?? "").trim();
  if (!query) throw new Error("place is empty");

  const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1`);
  const data = (await res.json()) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string }[];
  };
  const hit = data.results?.[0];
  if (!hit) throw new Error(`no location found for "${query}"`);

  const d = await getDb();
  await d.execute("INSERT INTO weather_locations (label, lat, lon) VALUES ($1, $2, $3)", [
    hit.admin1 ? `${hit.name}, ${hit.admin1}` : hit.name,
    hit.latitude,
    hit.longitude,
  ]);
  return { ok: true };
}

let cache: Record<string, unknown>[] = [];

async function refreshWeather() {
  const d = await getDb();
  const locations = await d.select<Location[]>("SELECT * FROM weather_locations");

  const results: Record<string, unknown>[] = [];
  let alerts = 0;
  for (const loc of locations) {
    const url =
      `${FORECAST_URL}?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      current?: { temperature_2m: number; weather_code: number };
    };
    const temp = data.current?.temperature_2m;
    const severe = (data.current?.weather_code ?? 0) >= 95; // thunderstorm+ in WMO codes
    if (severe) alerts++;
    results.push({
      id: `loc-${loc.id}`,
      title: `${loc.label}: ${temp != null ? `${temp.toFixed(0)}°C` : "—"}${severe ? " ⚠ severe" : ""}`,
    });
  }

  cache = results;
  await logActivity(
    "weather",
    "refresh",
    `checked ${locations.length} location(s)`,
    alerts > 0 ? `${alerts} severe alert(s)` : "no alerts"
  );
  return { ok: true, alerts };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  await refreshWeather();
  return cache;
}

export const weatherModule: ModuleManifest = {
  id: "hub.weather",
  name: "Weather & Alerts",
  description: "Current conditions for places you add. No API key needed.",
  panel: "list",
  skills: [
    { name: "add_location", run: addLocation },
    { name: "refresh", run: refreshWeather },
  ],
  load: loadRows,
  quickAdd: { skill: "add_location", argName: "place", placeholder: "Add a city or place…" },
  actions: [{ label: "Refresh", skill: "refresh" }],
  schedule: { skill: "refresh", intervalMinutes: 60 },
};

registerModule(weatherModule);
