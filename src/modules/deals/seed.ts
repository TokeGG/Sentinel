// Seeding of the curated deal sources. Idempotent: inserts only catalog urls that are missing and that the
// user never removed (`removed` in the src_state:deals map); every insert is OR IGNORE.
import { DEFAULT_SOURCES } from "./defaults.ts";
import { seedPlan, type StateMap } from "../news/sources/logic.ts";

export interface SeedDb {
  select<T>(sql: string, args?: unknown[]): Promise<T>;
  execute(sql: string, args?: unknown[]): Promise<unknown>;
}

export async function seedMissing(d: SeedDb, state: StateMap): Promise<number> {
  const have = (await d.select<{ url: string }[]>("SELECT url FROM deal_sources")).map((r) => r.url);
  const plan = seedPlan(DEFAULT_SOURCES, have, state);
  for (const s of plan) {
    await d.execute("INSERT OR IGNORE INTO deal_sources (url, label) VALUES ($1, $2)", [s.url, s.label]);
    await d.execute("INSERT OR IGNORE INTO deal_source_meta (url, category, enabled) VALUES ($1, $2, 1)", [s.url, s.category]);
  }
  return plan.length;
}
