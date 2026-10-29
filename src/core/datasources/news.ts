// News data sources: Hacker News search, Wikipedia's daily news, weather, US Congress.
import { arr, cap, enc, has, json, obj, str, stripHtml, type DataSource } from "./types.ts";

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, "/");
export const NEWS_SOURCES: DataSource[] = [
  {
    id: "hn", category: "news", name: "Hacker News (Algolia search)", about: "Stories by keyword with points.", sample: "local llm",
    request: (q) => ({ url: `https://hn.algolia.com/api/v1/search?query=${enc(q)}&tags=story&hitsPerPage=10` }),
    parse: (t) => cap(arr(obj(json(t)).hits).map(obj).map((h) => ({ title: str(h.title), detail: `${str(h.points)} points`, url: str(h.url) || `https://news.ycombinator.com/item?id=${str(h.objectID)}` }))),
  },
  {
    id: "wiki-news", category: "news", name: "Wikipedia in the news", about: "Today's 'In the news' items from Wikipedia's featured feed (filtered by the query).", sample: "",
    request: () => ({ url: `https://en.wikipedia.org/api/rest_v1/feed/featured/${today()}` }),
    parse: (t, q) => cap(arr(obj(json(t)).news).map((n) => stripHtml(str(obj(n).story))).filter((s) => has(s, q)).map((s) => ({ title: s.slice(0, 200) }))),
  },
  {
    id: "open-meteo", category: "news", name: "Open-Meteo forecast", about: "Current weather for 'lat,lon' (no key).", sample: "52.37,4.89",
    request: (q) => { const [la, lo] = q.split(",").map((x) => Number(x.trim())); return { url: `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,wind_speed_10m,precipitation` }; },
    parse: (t) => { const c = obj(obj(json(t)).current); if (!("temperature_2m" in c)) throw new Error("no current weather"); return [{ title: `${str(c.temperature_2m)} °C`, detail: `wind ${str(c.wind_speed_10m)} km/h · precip ${str(c.precipitation)} mm · ${str(c.time)}` }]; },
  },
  {
    id: "nws-alerts", category: "news", name: "NWS active alerts (US)", about: "US weather alerts by state code (e.g. TX).", sample: "TX",
    request: (q) => ({ url: `https://api.weather.gov/alerts/active?area=${enc(q.trim().toUpperCase())}` }),
    parse: (t) => cap(arr(obj(json(t)).features).map((f) => obj(obj(f).properties)).map((p) => ({ title: str(p.headline) || str(p.event), detail: `${str(p.severity)} · ${str(p.areaDesc).slice(0, 120)}` }))),
  },
  {
    id: "govtrack", category: "news", name: "GovTrack bills", about: "US bills by keyword (GovTrack API v2).", sample: "privacy",
    request: (q) => ({ url: `https://www.govtrack.us/api/v2/bill?q=${enc(q)}&limit=10&order_by=-current_status_date` }),
    parse: (t) => cap(arr(obj(json(t)).objects).map(obj).map((b) => ({ title: `${str(b.display_number)} ${str(b.title_without_number) || str(b.title)}`.trim(), detail: `${str(b.current_status)} · ${str(b.current_status_date)}`, url: str(b.link) || undefined }))),
  },
  {
    id: "congress-legislators", category: "news", name: "congress-legislators (current)", about: "Current members of Congress (one JSON file, filtered locally by name or state).", sample: "CA",
    request: () => ({ url: "https://unitedstates.github.io/congress-legislators/legislators-current.json" }),
    parse: (t, q) => cap(arr(json(t)).map(obj).map((l) => {
      const ts = arr(l.terms), term = obj(ts[ts.length - 1]), name = str(obj(l.name).official_full);
      return { title: name, detail: `${str(term.type)} ${str(term.state)}${term.district !== undefined ? `-${str(term.district)}` : ""} · ${str(term.party)}`, url: str(term.url) || undefined };
    }).filter((r) => has(`${r.title} ${r.detail}`, q))),
  },
];
