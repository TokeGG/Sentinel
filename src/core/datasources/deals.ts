// Deals + games data sources: game prices and store details.
import { arr, cap, enc, json, obj, openSearch, str, type DataSource } from "./types.ts";

export const DEALS_SOURCES: DataSource[] = [
  {
    id: "cheapshark", category: "deals", name: "CheapShark game deals", about: "PC game prices across stores by title.", sample: "portal",
    request: (q) => ({ url: `https://www.cheapshark.com/api/1.0/deals?title=${enc(q)}&pageSize=10` }),
    parse: (t) => cap(arr(json(t)).map(obj).map((d) => ({ title: str(d.title), detail: `$${str(d.salePrice)} (was $${str(d.normalPrice)})`, url: `https://www.cheapshark.com/redirect?dealID=${enc(str(d.dealID))}` }))),
  },
  {
    id: "steam-appdetails", category: "deals", name: "Steam store appdetails", about: "Price and discount for Steam app ids (comma list).", sample: "620",
    request: (q) => ({ url: `https://store.steampowered.com/api/appdetails?appids=${enc(q.replace(/\s+/g, ""))}&cc=us&filters=basic,price_overview` }),
    parse: (t) => cap(Object.entries(obj(json(t))).filter(([, v]) => obj(v).success === true).map(([id, v]) => {
      const d = obj(obj(v).data), p = obj(d.price_overview);
      return { title: str(d.name), detail: p.final_formatted ? `${str(p.final_formatted)}${Number(p.discount_percent) ? ` (-${str(p.discount_percent)}%)` : ""}` : "free or no price", url: `https://store.steampowered.com/app/${id}` };
    })),
  },
  {
    id: "steam-search", category: "media", name: "Steam store search", about: "Find Steam games (and app ids) by name.", sample: "hades",
    request: (q) => ({ url: `https://store.steampowered.com/api/storesearch/?term=${enc(q)}&cc=us&l=en` }),
    parse: (t) => cap(arr(obj(json(t)).items).map(obj).map((i) => {
      const p = obj(i.price);
      return { title: str(i.name), detail: `app ${str(i.id)}${p.final ? ` · $${(Number(p.final) / 100).toFixed(2)}` : ""}`, url: `https://store.steampowered.com/app/${str(i.id)}` };
    })),
  },
  {
    id: "pcgamingwiki", category: "media", name: "PCGamingWiki", about: "Fixes, settings and system notes for PC games (page search).", sample: "elden ring",
    request: (q) => ({ url: `https://www.pcgamingwiki.com/w/api.php?action=opensearch&search=${enc(q)}&limit=10&format=json` }),
    parse: (t) => openSearch(t),
  },
];
