// Pure per-room connection log: a ring buffer plus redaction/formatting helpers.
// Never put tokens in it: everything passes through redact() as well.
export interface Entry { t: number; msg: string }
export interface ConnLog { add(msg: string): void; entries(): Entry[]; text(): string }

export function redact(s: string): string {
  return s
    .replace(/oauth:[\w]+/gi, "oauth:***")
    .replace(/(bearer\s+)[\w.~+/=-]+/gi, "$1***")
    .replace(/((?:token|password|auth|authorization|secret|cookie)["']?\s*[:=]\s*["']?)[^"'\s,&}]+/gi, "$1***");
}

/** Short, single-line, tag-free, redacted piece of an HTTP body. */
export const excerpt = (body: string, max = 120): string => redact(body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()).slice(0, max);

export const fmtTime = (t: number): string => new Date(t).toISOString().slice(11, 23);

export function createLog(cap = 200, now: () => number = Date.now): ConnLog {
  let list: Entry[] = [];
  return {
    add(msg) {
      list.push({ t: now(), msg: redact(String(msg)).slice(0, 400) });
      if (list.length > cap) list = list.slice(list.length - cap);
    },
    entries: () => list.slice(),
    text: () => list.map((e) => `${fmtTime(e.t)} ${e.msg}`).join("\n"),
  };
}

/** Reconnect delay: 1s, 2s, 4s ... capped at 30s. */
export const backoffMs = (tries: number): number => Math.min(30_000, 1000 * 2 ** Math.max(0, tries));

export function closeHint(code: number): string {
  if (code === 1000 || code === 1001) return "normal close";
  if (code === 1006) return "abnormal close: no handshake (server refused the Origin, blocked by a firewall/Cloudflare, TLS or network error)";
  if (code === 1008 || code === 1003) return "server refused the connection (policy)";
  if (code === 1015) return "TLS handshake failed";
  return "closed by the server";
}

/** Logs the 1st, then every 100th unparseable frame. */
export function dropCounter(log: (m: string) => void): () => void {
  let n = 0;
  return () => {
    n++;
    if (n === 1 || n % 100 === 0) log(`unparseable frames dropped: ${n}`);
  };
}
