// Curated deal feeds per category page and per store page (at least 25 per category). Unverified.
import { feed, many, rd, rs, sd } from "./build.ts";

export const PC = [
  rd("buildapcsales", "pc"), rd("LaptopDeals", "pc"), rd("monitordeals", "pc"), rd("bapcsalescanada", "pc"), rd("buildapcsalesuk", "pc"),
  ...many(["ssd", "nvme", "graphics card", "rtx", "radeon", "cpu", "ryzen", "motherboard", "ddr5", "power supply", "pc case",
    "monitor", "gaming monitor", "mechanical keyboard", "gaming mouse", "external hard drive", "nas", "cpu cooler", "gaming laptop", "mini pc"], "pc"),
];

export const GAMES = [
  rd("GameDeals", "games"), rd("FreeGameFindings", "games"), rd("freegames", "games"), rd("NintendoSwitchDeals", "games"), rd("GreatXboxDeals", "games"),
  feed("https://blog.humblebundle.com/rss/", "Humble Bundle blog", "games"),
  ...many(["video game", "ps5", "xbox series", "nintendo switch", "switch game", "ps5 game", "steam key", "game pass", "controller",
    "gaming chair", "vr headset", "meta quest", "steam deck", "gaming headset", "pc game", "game bundle", "amiibo", "lego", "board game"], "games"),
];

export const GENERAL = [
  feed("https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1", "Slickdeals Frontpage", "general"),
  feed("https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1", "Slickdeals Popular", "general"),
  feed("https://www.dealnews.com/?rss=1", "DealNews", "general"),
  rd("deals", "general"), rd("coupons", "general"), rd("freebies", "general"), rd("frugalmalefashion", "general"), rd("frugalfemalefashion", "general"),
  ...many(["clothing", "shoes", "costco", "walmart", "target", "gift card", "luggage", "toys", "books", "camping",
    "sporting goods", "tires", "pet supplies", "groceries", "beauty", "watch", "kids", "travel"], "general"),
];

export const TECH = [
  feed("https://9to5toys.com/feed/", "9to5Toys", "tech"), rd("AppHookup", "tech"), rd("googleplaydeals", "tech"),
  ...many(["iphone", "ipad", "macbook", "apple watch", "airpods", "android phone", "samsung galaxy", "pixel", "tablet", "smartwatch",
    "tv", "oled tv", "soundbar", "headphones", "earbuds", "bluetooth speaker", "camera", "drone", "smart home", "echo",
    "roku", "power bank", "usb-c charger", "kindle"], "tech"),
];

export const HOME = [
  rd("frugal", "home"),
  ...many(["vacuum", "robot vacuum", "air fryer", "instant pot", "coffee maker", "cookware", "knife set", "mattress", "bedding", "furniture",
    "office chair", "standing desk", "power tools", "dewalt", "grill", "lawn mower", "patio", "home improvement", "air purifier",
    "space heater", "fan", "lighting", "smart thermostat", "appliances", "washer"], "home"),
];

// Store pages: feeds narrowed to one store (search RSS; no store publishes an official deals feed we can confirm).
export const STORES = [
  sd("amazon", "amazon"), rs("buildapcsales", "amazon", "amazon"), rs("deals", "amazon", "amazon"), rs("GameDeals", "amazon", "amazon"),
  sd("newegg", "newegg"), rs("buildapcsales", "newegg", "newegg"), rs("LaptopDeals", "newegg", "newegg"),
  sd("best buy", "bestbuy"), rs("buildapcsales", "best buy", "bestbuy"), rs("deals", "best buy", "bestbuy"),
  rs("GameDeals", "steam", "steam"), sd("steam", "steam"), feed("https://store.steampowered.com/feeds/news/", "Steam news", "steam"),
  rs("GameDeals", "epic games", "epic"), rs("FreeGameFindings", "epic", "epic"), rs("freegames", "epic", "epic"),
  rs("GameDeals", "gog", "gog"), rs("FreeGameFindings", "gog", "gog"),
  rs("GameDeals", "humble", "humble"), sd("humble bundle", "humble"),
];
