// Advent of Code fetches (Tauri glue): cache first, at most one request per page/input, spaced by throttle.ts,
// sent by Rust `coach_aoc_fetch` with a descriptive User-Agent. Nothing is ever submitted to the site.
import { invoke } from "@tauri-apps/api/core";
import { getSetting, setSetting } from "../../skills/store";
import { cachedPuzzle, getAocCookie, savePuzzle } from "./coachStore";
import { COACH_AOC_LAST_KEY } from "./coachSql";
import { aocKey, aocPageText, validAoc, type Puzzle } from "./puzzles";
import { fetchPlan, type FetchKind } from "./throttle";

async function fetchOnce(year: number, day: number, kind: FetchKind, cached: Puzzle | null): Promise<string | null> {
  const plan = fetchPlan(kind, cached, Number(await getSetting(COACH_AOC_LAST_KEY)) || null, Date.now());
  if (plan.kind === "cached") return null;
  if (plan.kind === "wait") throw new Error(`Waiting between requests to adventofcode.com: try again in ${Math.ceil(plan.ms / 1000)} s.`);
  const cookie = await getAocCookie();
  if (!cookie) throw new Error("Paste your Advent of Code session cookie first (stored in the OS keychain).");
  await setSetting(COACH_AOC_LAST_KEY, String(Date.now()));
  const r = await invoke<{ status: number; body: string }>("coach_aoc_fetch", { year, day, input: kind === "input", cookie });
  if (r.status !== 200) throw new Error(`adventofcode.com answered ${r.status}${r.status === 400 || r.status === 500 ? " (session cookie expired?)" : r.status === 404 ? " (not unlocked yet?)" : ""}.`);
  return r.body;
}

/** The puzzle (statement, then personal input on a second press if needed), served from cache whenever possible. */
export async function loadAoc(year: number, day: number): Promise<Puzzle> {
  if (!validAoc(year, day)) throw new Error("Pick a year from 2015 and a day 1-25.");
  const key = aocKey(year, day);
  let p = await cachedPuzzle(key);
  const page = await fetchOnce(year, day, "page", p);
  if (page !== null) {
    const { title, text } = aocPageText(page);
    p = { key, source: "aoc", title: `${year} day ${day}: ${title}`, statement: text, input: p?.input ?? null };
    await savePuzzle(p);
  }
  return p!;
}
export async function loadAocInput(p: Puzzle): Promise<Puzzle> {
  const [, y, d] = p.key.split(":").map(Number);
  const body = await fetchOnce(y, d, "input", p);
  if (body === null) return p;
  const next = { ...p, input: body };
  await savePuzzle(next);
  return next;
}
/** Refresh the cached statement (part two unlocks after you solve part one): one deliberate refetch. */
export async function refetchAocPage(p: Puzzle): Promise<Puzzle> {
  const [, y, d] = p.key.split(":").map(Number);
  await savePuzzle({ ...p, statement: "" }).catch(() => {});
  return loadAoc(y, d).catch(async (e) => { await savePuzzle(p); throw e; });
}
