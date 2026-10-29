// Pure link extraction for the calendar detail card: http(s) and www. links in free
// text (title, notes, a row's url), trailing punctuation trimmed, de-duplicated.
const RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

export function extractLinks(...texts: unknown[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    if (typeof t !== "string") continue;
    for (const m of t.match(RE) ?? []) {
      let u = m.replace(/[.,;:!?)\]}]+$/, "");
      if (/^www\./i.test(u)) u = `https://${u}`;
      if (!/^https?:\/\/[^/\s]+\.[^/\s]/i.test(u) && !/^https?:\/\/localhost/i.test(u)) continue;
      if (!out.includes(u)) out.push(u);
    }
  }
  return out.slice(0, 10);
}
