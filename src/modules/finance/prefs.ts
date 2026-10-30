// Pure Finance/Deals preferences (app_settings `fin_prefs` JSON) + the shared money formatter.
// Currency is a display choice only: no exchange-rate conversion happens anywhere.
export type FinPrefs = {
  currency: string; // ISO 4217, e.g. "USD"
  locale: string; // number format, e.g. "en-US", "de-DE"
  blur: boolean; // portfolio privacy blur
  cryptoMinutes: number; // crypto refresh interval while module Auto-refresh is on
  stockMinutes: number; // stock refresh interval while module Auto-refresh is on
  categories: string[]; // spending categories (budgets, report, afford)
  remindDays: number; // subscription renewal reminders: days ahead
  cash: number; // manual "other assets" (cash, savings) for net worth
};

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", "INR", "BRL", "MXN"];
export const LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "ja-JP", "sv-SE", "pt-BR", "hi-IN"];
export const INTERVALS = [5, 15, 30, 60, 240];
export const DEFAULT_CATEGORIES = ["Food", "Housing", "Transport", "Bills", "Fun", "Shopping", "Health", "Other"];
export const DEFAULT_PREFS: FinPrefs = {
  currency: "USD", locale: "en-US", blur: false, cryptoMinutes: 60, stockMinutes: 60,
  categories: DEFAULT_CATEGORIES, remindDays: 7, cash: 0,
};

const pick = <T>(v: unknown, list: T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const clean = (v: unknown) => String(v ?? "").trim().slice(0, 30);

/** Any parsed JSON -> valid prefs (unknown values fall back to defaults). */
export function sanitizePrefs(raw: unknown): FinPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cats = Array.isArray(r.categories) ? [...new Set(r.categories.map(clean).filter(Boolean))].slice(0, 40) : DEFAULT_CATEGORIES;
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && v >= lo && v <= hi ? v : d);
  return {
    currency: pick(r.currency, CURRENCIES, "USD"),
    locale: pick(r.locale, LOCALES, "en-US"),
    blur: r.blur === true,
    cryptoMinutes: pick(r.cryptoMinutes, INTERVALS, 60),
    stockMinutes: pick(r.stockMinutes, INTERVALS, 60),
    categories: cats.length ? cats : DEFAULT_CATEGORIES,
    remindDays: n(r.remindDays, 1, 60, 7),
    cash: n(r.cash, -1e12, 1e12, 0),
  };
}

export function parsePrefs(json: string | null): FinPrefs {
  try { return sanitizePrefs(json ? JSON.parse(json) : null); } catch { return DEFAULT_PREFS; }
}

let current: Pick<FinPrefs, "currency" | "locale"> = DEFAULT_PREFS;
/** Sets the format every fmtMoney/fmtPrice call uses (panels call it after loading prefs). */
export const setMoneyFormat = (p: Pick<FinPrefs, "currency" | "locale">) => { current = { currency: p.currency, locale: p.locale }; };

/** Money in the chosen currency/number format; values under 1 keep ~4 significant digits (crypto). */
export function fmtMoney(n: unknown, f: Pick<FinPrefs, "currency" | "locale"> = current): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  const whole = f.currency === "JPY" && a >= 1;
  const max = whole ? 0 : a >= 1 || a === 0 ? 2 : Math.min(8, Math.max(4, 3 - Math.floor(Math.log10(a))));
  try {
    return new Intl.NumberFormat(f.locale, { style: "currency", currency: f.currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: max }).format(n);
  } catch {
    return `${f.currency} ${n.toFixed(2)}`;
  }
}

/** Categories editor ops (pure): add (deduped), rename (keeps order), remove. */
export function editCategories(list: string[], op: "add" | "rename" | "remove", name: string, to = ""): string[] {
  const n = clean(name), t = clean(to);
  if (op === "add") return n && !list.includes(n) ? [...list, n] : list;
  if (op === "remove") return list.filter((c) => c !== n);
  return t && !list.includes(t) ? list.map((c) => (c === n ? t : c)) : list;
}
