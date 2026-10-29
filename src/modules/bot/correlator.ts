// Matches `bot-result` events {id, ok, json} to the command that is waiting for them. Pure: timers are injected.
export interface BotResult { id: string; ok: boolean; json: string }
export interface Timers { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export const TIMEOUT_JSON = JSON.stringify("timeout");

export function makeCorrelator(timers: Timers = realTimers) {
  const waiting = new Map<string, { done(r: BotResult): void; timer: unknown }>();
  const finish = (id: string, r: BotResult): boolean => {
    const w = waiting.get(id);
    if (!w) return false;
    waiting.delete(id);
    timers.clear(w.timer);
    w.done(r);
    return true;
  };
  return {
    /** Register BEFORE sending the command. Resolves with the result, or with a timeout failure after `ms`. Never rejects. */
    expect(id: string, ms: number): Promise<BotResult> {
      if (waiting.has(id)) throw new Error(`duplicate command id ${id}`);
      return new Promise((resolve) => {
        waiting.set(id, { done: resolve, timer: timers.set(() => void finish(id, { id, ok: false, json: TIMEOUT_JSON }), ms) });
      });
    },
    /** False for an unknown id (a late or duplicate result): ignored. */
    deliver: (r: BotResult): boolean => finish(r.id, r),
    cancel: (id: string, why = "cancelled") => void finish(id, { id, ok: false, json: JSON.stringify(why) }),
    failAll(why: string) { for (const id of [...waiting.keys()]) finish(id, { id, ok: false, json: JSON.stringify(why) }); },
    size: () => waiting.size,
  };
}
export type Correlator = ReturnType<typeof makeCorrelator>;

/** The text of a failed result's json ("timeout", an error message, ...). */
export function failureText(r: BotResult): string {
  try { const v = JSON.parse(r.json); return typeof v === "string" ? v : JSON.stringify(v); } catch { return r.json; }
}
export const isTimeout = (r: BotResult) => !r.ok && r.json === TIMEOUT_JSON;
