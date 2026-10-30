// Parsing the coach's JSON replies and formatting the recap, pure. Anything malformed becomes a readable error, never code.
export interface Solve { restate: string; plan: string[]; code: string; steps: string[] }
export interface Recap { learned: string[]; mistakes: string[]; topics: string[]; quiz: { question: string; answer: string } | null }

const obj = (t: string): Record<string, unknown> | null => {
  try { const j = JSON.parse(t); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch { return null; }
};
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => s(x, max)).filter(Boolean).slice(0, n) : []);
/** Strip a ``` fence if the model wrapped its code in one. */
export const unfence = (c: string) => c.replace(/^\s*```[a-z]*\n?/i, "").replace(/\n?```\s*$/, "");

export function parseSolve(text: string): Solve | { error: string } {
  const o = obj(text);
  if (!o) return { error: "The model's reply was not JSON. Try again." };
  const code = unfence(s(o.code, 20000));
  if (!code) return { error: "The model did not write any code. Try again." };
  return { restate: s(o.restate, 1200), plan: list(o.plan, 12, 300), code, steps: list(o.steps, 20, 400) };
}

export function parseRecap(text: string): Recap {
  const o = obj(text) ?? {};
  const q = o.quiz && typeof o.quiz === "object" ? (o.quiz as Record<string, unknown>) : null;
  const quiz = q && s(q.question, 400) ? { question: s(q.question, 400), answer: s(q.answer, 400) } : null;
  return { learned: list(o.learned, 6, 300), mistakes: list(o.mistakes, 6, 300), topics: list(o.topics, 6, 40).map((t) => t.toLowerCase()), quiz };
}

export const parseHint = (text: string) => s(obj(text)?.hint, 600) || "No hint came back. Try asking again.";

/** Plain-text recap shown in the panel and stored with the attempt. */
export function formatRecap(r: Recap, verdict: string): string {
  const sec = (h: string, xs: string[]) => (xs.length ? [`${h}:`, ...xs.map((x) => `- ${x}`)] : []);
  return [`Result: ${verdict}`, ...sec("What we learned", r.learned), ...sec("Mistakes", r.mistakes),
    ...(r.topics.length ? [`Topics: ${r.topics.join(", ")}`] : []), ...(r.quiz ? [`Your quiz: ${r.quiz.question}`] : [])].join("\n");
}
/** Mistake lines for the site notebook (bot learning), one per mistake, tagged with the puzzle. */
export const mistakeNotes = (title: string, r: Recap) => r.mistakes.map((m) => `Coach (${title.slice(0, 40)}): ${m}`);
