// Run-result shaping, pure (mirrors the cap in Rust coach_run.rs): output capped, verdict in plain words.
export interface RunResult { stdout: string; stderr: string; code: number | null; timedOut: boolean; truncated?: boolean }
export const MAX_OUT = 8000;

export function capText(s: string, max = MAX_OUT): { text: string; cut: boolean } {
  return s.length <= max ? { text: s, cut: false } : { text: `${s.slice(0, max)}\n... (${s.length - max} more characters cut)`, cut: true };
}
export function capRun(r: RunResult, max = MAX_OUT): RunResult {
  const o = capText(r.stdout, max), e = capText(r.stderr, Math.floor(max / 2));
  return { ...r, stdout: o.text, stderr: e.text, truncated: !!r.truncated || o.cut || e.cut };
}
/** Last non-empty stdout line: the usual place a puzzle answer is printed. */
export const answerOf = (r: RunResult) => r.stdout.trim().split("\n").filter((l) => l.trim()).pop()?.trim() ?? "";
export function verdict(r: RunResult, expected?: string): string {
  if (r.timedOut) return "Stopped: it ran past the time limit.";
  if (r.code !== 0) return `It crashed (exit ${r.code ?? "?"}). Read the error below.`;
  const a = answerOf(r);
  if (expected === undefined) return a ? `Printed ${a}. Enter it yourself on the site if it looks right.` : "It ran but printed nothing.";
  return a === expected ? `Correct: ${a}.` : `Printed ${a || "nothing"}, expected ${expected}.`;
}
