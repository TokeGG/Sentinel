// Starter knowledge seeded once into an empty bot_notes (app_settings `bot_notes_seeded`), so a fresh bot knows the
// observation format and the common site patterns. They are ordinary notes: editable and deletable. Pure.
import type { Note } from "./knowledge.ts";

export const SEEDED_KEY = "bot_notes_seeded";
const n = (title: string, text: string): Note => ({ title, source: "text", text });

export const STARTER_NOTES: readonly Note[] = [
  n("Reading the page", "The page arrives as URL, Title, Text (the visible text, cut short) and Elements. Each element line is [ID] role: label. Use the ID in click/type. (off-screen) means scroll first or click it anyway; the browser scrolls it into view. role password = never type into it."),
  n("Cookie banners", "Cookie or consent banners: click a button labelled Reject all, Only necessary, Decline, or if none exists Accept / OK / Agree, once. Then continue the task. Do not open the settings dialog of the banner."),
  n("Search boxes", "Search: type the query into the textbox labelled Search (or with a placeholder like Search...), then press Enter. If Enter does nothing, click the button labelled Search or a magnifier button next to it."),
  n("Pagination", "Long lists: look for links or buttons labelled Next, More, Load more, a page number, or an arrow. Prefer them over many scrolls. Stop when the answer is found; you rarely need more than 3 pages."),
  n("Login walls", "If the page asks to sign in, log in, create an account or solve a captcha before showing what you need, do not try: answer fail with the reason 'needs you to sign in on <site>' so the user can do it."),
  n("Prices and deals", "Prices: report the price with currency, the shop name and the page link. Note if a price is a sale, needs a membership or excludes shipping. Never add to cart or buy."),
  n("Forms", "Forms: type each value into the field whose label matches it. Leave unknown fields empty. Submitting is irreversible: only submit when the goal says so; the user is asked first."),
  n("When stuck", "If two different approaches changed nothing, try goto with a direct search URL such as https://duckduckgo.com/?q=<words>, or answer fail with what you tried."),
];

/** Seed only into an empty notebook that was never seeded (deleting the starter notes keeps them deleted). */
export const shouldSeed = (noteCount: number, seededFlag: string | null) => noteCount === 0 && !seededFlag;
