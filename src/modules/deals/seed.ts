// First-run seeding of the default deal sources. Idempotent: only when the
// deal_sources table is empty, and every insert is OR IGNORE.
import { DEFAULT_SOURCES } from "./defaults.ts";

export interface SeedDb {
  select<T>(sql: string, args?: unknown[]): Promise<T>;
  execute(sql: string, args?: unknown[]): Promise<unknown>;
}

export async function seedIfEmpty(d: SeedDb): Promise<boolean> {
  const n = (await d.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM deal_sources"))[0]?.n ?? 0;
  if (n > 0) return false;
  for (const s of DEFAULT_SOURCES) {
    await d.execute("INSERT OR IGNORE INTO deal_sources (url, label) VALUES ($1, $2)", [s.url, s.label]);
    await d.execute("INSERT OR IGNORE INTO deal_source_meta (url, category, enabled) VALUES ($1, $2, 1)", [s.url, s.category]);
  }
  return true;
}
