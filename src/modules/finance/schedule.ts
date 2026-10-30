// Pure: which asset kinds a scheduled tick should refresh, from the per-kind interval settings.
// The tick itself only runs while the module's Auto-refresh opt-in is on (core/scheduler.ts).
export const TICK_MINUTES = 5;

export function dueKinds(now: number, last: { stock: number; crypto: number }, p: { stockMinutes: number; cryptoMinutes: number }): ("stock" | "crypto")[] {
  const out: ("stock" | "crypto")[] = [];
  // 30 s slack so a 5-min interval is not skipped by timer jitter.
  if (now - last.stock >= p.stockMinutes * 60000 - 30000) out.push("stock");
  if (now - last.crypto >= p.cryptoMinutes * 60000 - 30000) out.push("crypto");
  return out;
}
