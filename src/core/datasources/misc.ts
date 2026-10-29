// Data sources for mail, social, dev, system and productivity panels.
import { arr, cap, enc, has, json, obj, openSearch, str, type DataSource } from "./types.ts";

export const MISC_SOURCES: DataSource[] = [
  {
    id: "hibp-breaches", category: "mail", name: "HIBP breach list", about: "Public list of known data breaches (no key); filter by site or domain.", sample: "adobe",
    request: () => ({ url: "https://haveibeenpwned.com/api/v3/breaches" }),
    parse: (t, q) => cap(arr(json(t)).map(obj).filter((b) => has(`${str(b.Name)} ${str(b.Domain)}`, q)).map((b) => ({ title: `${str(b.Title)} (${str(b.Domain)})`, detail: `${str(b.BreachDate)} · ${str(b.PwnCount)} accounts` }))),
  },
  {
    id: "rdap", category: "mail", name: "RDAP domain lookup", about: "Registration date of a sender's domain (new domains are a scam sign).", sample: "example.com",
    request: (q) => ({ url: `https://rdap.org/domain/${enc(q.trim().toLowerCase())}` }),
    parse: (t) => { const o = obj(json(t)); const ev = arr(o.events).map(obj); const reg = str(ev.find((e) => e.eventAction === "registration")?.eventDate); return [{ title: str(o.ldhName).toLowerCase(), detail: reg ? `registered ${reg.slice(0, 10)}` : "no registration date" }]; },
  },
  {
    id: "reddit-search", category: "social", name: "Reddit search", about: "Public posts by keyword (JSON, no sign-in).", sample: "tauri",
    request: (q) => ({ url: `https://www.reddit.com/search.json?q=${enc(q)}&limit=10` }),
    parse: (t) => cap(arr(obj(obj(json(t)).data).children).map((c) => obj(obj(c).data)).map((d) => ({ title: str(d.title), detail: `r/${str(d.subreddit)} · ${str(d.score)} points`, url: `https://www.reddit.com${str(d.permalink)}` }))),
  },
  {
    id: "bsky-search", category: "social", name: "Bluesky public search", about: "Public posts by keyword (public AppView; may need sign-in later).", sample: "tauri",
    request: (q) => ({ url: `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${enc(q)}&limit=10` }),
    parse: (t) => cap(arr(obj(json(t)).posts).map(obj).map((p) => ({ title: str(obj(p.record).text).slice(0, 200), detail: `@${str(obj(p.author).handle)} · ${str(p.likeCount)} likes` }))),
  },
  {
    id: "github-search", category: "dev", name: "GitHub repo search", about: "Public repositories by keyword (unauthenticated, rate-limited).", sample: "tauri plugin",
    request: (q) => ({ url: `https://api.github.com/search/repositories?q=${enc(q)}&per_page=10` }),
    parse: (t) => cap(arr(obj(json(t)).items).map(obj).map((r) => ({ title: str(r.full_name), detail: `★${str(r.stargazers_count)} · ${str(r.description).slice(0, 140)}`, url: str(r.html_url) || undefined }))),
  },
  {
    id: "npm-search", category: "dev", name: "npm registry search", about: "npm packages by keyword with version.", sample: "sqlite",
    request: (q) => ({ url: `https://registry.npmjs.org/-/v1/search?text=${enc(q)}&size=10` }),
    parse: (t) => cap(arr(obj(json(t)).objects).map((o) => obj(obj(o).package)).map((p) => ({ title: `${str(p.name)}@${str(p.version)}`, detail: str(p.description).slice(0, 140), url: str(obj(p.links).npm) || undefined }))),
  },
  {
    id: "endoflife", category: "system", name: "endoflife.date", about: "Support/end-of-life dates for a product (windows, nodejs, python).", sample: "windows",
    request: (q) => ({ url: `https://endoflife.date/api/${enc(q.trim().toLowerCase())}.json` }),
    parse: (t) => cap(arr(json(t)).map(obj).map((c) => ({ title: `${str(c.cycle)}${c.latest ? ` (latest ${str(c.latest)})` : ""}`, detail: `EOL ${c.eol === false ? "not set" : str(c.eol)}` }))),
  },
  {
    id: "msrc-updates", category: "system", name: "Microsoft security update releases", about: "Monthly Windows security update documents (MSRC CVRF index).", sample: "2026",
    request: () => ({ url: "https://api.msrc.microsoft.com/cvrf/v3.0/updates" }),
    parse: (t, q) => cap(arr(obj(json(t)).value).map(obj).filter((u) => has(`${str(u.ID)} ${str(u.DocumentTitle)}`, q)).reverse().map((u) => ({ title: str(u.DocumentTitle) || str(u.ID), detail: `released ${str(u.InitialReleaseDate).slice(0, 10)}` }))),
  },
  {
    id: "wikipedia", category: "productivity", name: "Wikipedia search", about: "Article titles and links for a topic.", sample: "pomodoro technique",
    request: (q) => ({ url: `https://en.wikipedia.org/w/api.php?action=opensearch&search=${enc(q)}&limit=10&format=json&origin=*` }),
    parse: (t) => openSearch(t),
  },
  {
    id: "dictionary", category: "productivity", name: "Free Dictionary API", about: "English word definitions.", sample: "serendipity",
    request: (q) => ({ url: `https://api.dictionaryapi.dev/api/v2/entries/en/${enc(q.trim())}` }),
    parse: (t) => cap(arr(json(t)).flatMap((e) => arr(obj(e).meanings).map((m) => ({ title: `${str(obj(e).word)} (${str(obj(m).partOfSpeech)})`, detail: str(obj(arr(obj(m).definitions)[0]).definition) })))),
  },
  {
    id: "nager-holidays", category: "productivity", name: "Nager.Date public holidays", about: "Public holidays this year for a country code (US, NL, DE).", sample: "US",
    request: (q) => ({ url: `https://date.nager.at/api/v3/PublicHolidays/${new Date().getFullYear()}/${enc(q.trim().toUpperCase())}` }),
    parse: (t) => cap(arr(json(t)).map(obj).map((h) => ({ title: `${str(h.date)} ${str(h.localName)}`, detail: str(h.name) }))),
  },
];
