// Readability-lite: turn a fetched HTML page into a title + plain/markdown text.
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…" };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") { const c = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });

const DROP = /<(script|style|noscript|svg|iframe|nav|header|footer|aside|form|template)\b[\s\S]*?<\/\1\s*>/gi;

/** Strips markup; headings become `#`, list items `- `, block ends newlines. */
export function htmlToText(html: string): string {
  const t = html.replace(/<!--[\s\S]*?-->/g, "").replace(DROP, "")
    .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => `\n\n${"#".repeat(+n)} `)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre|section|article|ul|ol|table)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(t).replace(/[ \t\f\v ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const pick = (html: string, tag: string) => new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(html)?.[1];

export function extractReadable(html: string, url = ""): { title: string; text: string } {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const h1 = pick(html, "h1");
  const raw = og ?? pick(html, "title") ?? h1 ?? "";
  const title = decodeEntities(raw.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() || url || "Clipped page";
  const main = pick(html, "article") ?? pick(html, "main") ?? pick(html, "body") ?? html;
  return { title, text: htmlToText(main) };
}

export const clipNote = (url: string, title: string, text: string) => `# ${title}\n\nSource: ${url}\n\n${text}\n`;
export const isHttpUrl = (u: string) => /^https?:\/\/[^\s]+$/i.test(u.trim());
