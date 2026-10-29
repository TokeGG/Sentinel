// HTML mail sanitizer. Pure, DOM-free, ALLOW-LIST based: the output contains only
// the tags/attributes below, rebuilt from scratch (text and attribute values are
// re-escaped), so nothing in the input survives by accident. Not emitted, ever:
// <script>/<style>/<iframe>/<object>/<embed>/<svg>/<form>/<link>/<meta>/<base>,
// comments, style/class/id/on* attributes, javascript:/data:text URLs, srcset.
// Links lose their href (shown via `links`, opened by the panel through safeLink);
// remote images are removed unless `loadImages` is set.
export interface Clean { html: string; blockedImages: number; links: { text: string; url: string }[] }

const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "frame", "frameset", "object", "applet", "svg", "math", "head", "title", "noscript", "template", "textarea", "xmp", "noembed", "noframes", "select", "audio", "video", "canvas"]);
const ALLOWED = new Set(["a", "b", "i", "u", "em", "strong", "p", "br", "div", "span", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "hr", "img", "center", "small", "big", "sub", "sup", "s", "strike", "font", "dl", "dt", "dd"]);
const VOID = new Set(["br", "hr", "img"]);
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
const compact = (u: string) => u.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "");

/** http(s) only, for link display/opening. */
export function webUrl(raw: string): string | null {
  const u = decodeEntities(raw).trim();
  return /^https?:\/\/[^\s]+$/i.test(compact(u)) && !/[\u0000-\u0020]/.test(u) ? u : null;
}
function imgSrc(raw: string, loadImages: boolean): string | null | "blocked" {
  const u = decodeEntities(raw).trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(u)) return u;
  if (!webUrl(u)) return null; // cid:, javascript:, file:, relative ... dropped
  return loadImages ? u : "blocked";
}

const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
function attrsOf(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR)) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}
const num = (v?: string) => (v && /^\d{1,4}$/.test(v.trim()) ? v.trim() : null);

export function sanitizeHtml(input: string, opts: { loadImages?: boolean } = {}): Clean {
  const TAG = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>?/g;
  let out = "", last = 0, blockedImages = 0, skipUntil = -1;
  const links: Clean["links"] = [];
  const open: { href: string | null; start: number }[] = [];
  const text = (s: string) => { out += esc(decodeEntities(s)); };
  for (const m of input.matchAll(TAG)) {
    const idx = m.index!;
    if (idx < skipUntil) continue;
    if (idx > last) text(input.slice(last, idx));
    last = idx + m[0].length;
    if (!m[2]) continue; // comment / doctype / PI
    const name = m[2].toLowerCase(), closing = m[1] === "/";
    if (!closing && DROP_WITH_CONTENT.has(name)) {
      const end = new RegExp(`</${name}[\\s/]*>`, "i").exec(input.slice(last));
      skipUntil = last = end ? last + end.index + end[0].length : input.length;
      continue;
    }
    if (!ALLOWED.has(name)) continue;
    if (closing) {
      if (VOID.has(name)) continue;
      if (name === "a") {
        const a = open.pop();
        if (a?.href) links.push({ text: out.slice(a.start).replace(/<[^>]*>/g, "").trim().slice(0, 80), url: a.href });
      }
      out += `</${name}>`;
      continue;
    }
    const at = attrsOf(m[3] ?? "");
    let attrs = "";
    if (name === "a") {
      open.push({ href: webUrl(at.href ?? ""), start: out.length });
      if (at.title) attrs += ` title="${esc(decodeEntities(at.title))}"`;
    } else if (name === "img") {
      const src = imgSrc(at.src ?? "", !!opts.loadImages);
      if (src === "blocked") blockedImages++;
      if (!src || src === "blocked") continue;
      attrs = ` src="${esc(src)}" alt="${esc(decodeEntities(at.alt ?? ""))}"`;
      for (const k of ["width", "height"]) if (num(at[k])) attrs += ` ${k}="${num(at[k])}"`;
    } else if (name === "td" || name === "th") {
      for (const k of ["colspan", "rowspan"]) if (num(at[k])) attrs += ` ${k}="${num(at[k])}"`;
    }
    out += `<${name}${attrs}>`;
  }
  if (last < input.length && skipUntil < input.length) text(input.slice(last));
  while (open.length) { open.pop(); out += "</a>"; } // keep nesting valid when <a> was left open
  const seen = new Set<string>();
  return { html: out, blockedImages, links: links.filter((l) => !seen.has(l.url) && !!seen.add(l.url)) };
}

/** Full srcdoc for the sandboxed iframe (sandbox="" => no scripts, no forms, no popups). */
export function buildSrcdoc(clean: string, loadImages: boolean): string {
  const img = loadImages ? "img-src data: https:" : "img-src data:";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${img}; style-src 'unsafe-inline'"><style>body{margin:0;padding:8px;font:14px/1.45 system-ui,sans-serif;color:#222;background:#fff;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#2a5db0;text-decoration:underline}blockquote{margin:6px 0;padding-left:10px;border-left:3px solid #ccc;color:#555}table{max-width:100%}</style></head><body>${clean}</body></html>`;
}
