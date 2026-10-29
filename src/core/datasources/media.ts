// Media data sources: TV shows, books, music/podcasts/apps.
import { arr, cap, enc, json, obj, str, stripHtml, type DataSource } from "./types.ts";

export const MEDIA_SOURCES: DataSource[] = [
  {
    id: "tvmaze", category: "media", name: "TVmaze", about: "TV show search: status, premiere, network.", sample: "severance",
    request: (q) => ({ url: `https://api.tvmaze.com/search/shows?q=${enc(q)}` }),
    parse: (t) => cap(arr(json(t)).map((x) => obj(obj(x).show)).map((s) => ({ title: str(s.name), detail: [str(s.status), str(s.premiered), stripHtml(str(s.summary)).slice(0, 140)].filter(Boolean).join(" · "), url: str(s.url) || undefined }))),
  },
  {
    id: "openlibrary", category: "media", name: "Open Library", about: "Book search: authors, first published year.", sample: "dune",
    request: (q) => ({ url: `https://openlibrary.org/search.json?q=${enc(q)}&limit=10&fields=title,author_name,first_publish_year,key` }),
    parse: (t) => cap(arr(obj(json(t)).docs).map(obj).map((d) => ({ title: str(d.title), detail: [arr(d.author_name).map(str).join(", "), str(d.first_publish_year)].filter(Boolean).join(" · "), url: str(d.key) ? `https://openlibrary.org${str(d.key)}` : undefined }))),
  },
  {
    id: "itunes", category: "media", name: "iTunes Search API", about: "Music, podcasts, apps and films in Apple's catalog.", sample: "lofi",
    request: (q) => ({ url: `https://itunes.apple.com/search?term=${enc(q)}&limit=10` }),
    parse: (t) => cap(arr(obj(json(t)).results).map(obj).map((r) => ({ title: str(r.trackName) || str(r.collectionName), detail: [str(r.artistName), str(r.kind) || str(r.wrapperType)].filter(Boolean).join(" · "), url: str(r.trackViewUrl) || str(r.collectionViewUrl) || undefined }))),
  },
];
