// Feature extraction for the taste layer: an item becomes a few string features
// ("src:slickdeals", "kw:rtx", ...). The prefix says what kind of feature it is.
const STOP = new Set(("the and for you your with this that from are was were not but have has had how what why when who " +
  "its into out new all can will just about our their they them more most than then too very now get got has " +
  "off now today here there over under per via one two top best free deal deals sale").split(" "));

/** Lowercase keyword tokens: >=3 chars, no stopwords or bare numbers, light plural strip, unique, at most `max`. */
export function tokens(text: string, max = 8): string[] {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const w = raw.length > 3 && raw.endsWith("s") && !raw.endsWith("ss") ? raw.slice(0, -1) : raw;
    if (w.length >= 3 && !STOP.has(w) && !STOP.has(raw) && !/^\d+$/.test(w)) out.add(w);
    if (out.size >= max) break;
  }
  return [...out];
}

export interface FeatureInput {
  source?: string | null;
  channel?: string | null;
  sender?: string | null;
  repo?: string | null;
  ticker?: string | null;
  category?: string | null;
  store?: string | null;
  price?: string | null; // a band label such as "under-25"
  text?: string | null;
  extra?: string[]; // already-prefixed features
}

const one = (prefix: string, v: string | null | undefined): string[] => {
  const s = (v ?? "").toString().trim().toLowerCase().replace(/\s+/g, "-");
  return s ? [`${prefix}:${s.slice(0, 60)}`] : [];
};

export function itemFeatures(i: FeatureInput): string[] {
  const all = [
    ...one("src", i.source), ...one("ch", i.channel), ...one("from", i.sender), ...one("repo", i.repo),
    ...one("tick", i.ticker), ...one("cat", i.category), ...one("store", i.store), ...one("price", i.price),
    ...tokens(i.text ?? "").map((t) => `kw:${t}`), ...(i.extra ?? []),
  ];
  return [...new Set(all)];
}

const KIND: Record<string, string> = {
  src: "source", ch: "channel", from: "sender", repo: "repo", tick: "ticker", cat: "category",
  store: "store", price: "price", tag: "tag", kw: "keyword",
};
export const featureKind = (f: string): string => f.slice(0, f.indexOf(":"));

/** Human text for a feature: `keyword "rtx"`. */
export function featureLabel(f: string): string {
  const k = featureKind(f);
  return `${KIND[k] ?? k} “${f.slice(k.length + 1)}”`;
}
