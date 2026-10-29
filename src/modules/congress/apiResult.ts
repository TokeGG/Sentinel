// Pure: turn a raw HTTP reply into JSON or a readable error. GovTrack failures used to surface as a bare
// "Unexpected token <" (an HTML error/notice page parsed as JSON) or were swallowed per part; now every
// failure names the URL, the HTTP status and what came back instead of JSON.
export function jsonOrError(url: string, status: number, contentType: string, body: string): unknown {
  const where = url.replace(/[?#].*$/, "");
  const snippet = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  if (status < 200 || status > 299) throw new Error(`HTTP ${status} from ${where}${snippet ? `: ${snippet}` : ""}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${where} did not return JSON (${contentType || "no content type"})${snippet ? `: ${snippet}` : ""}`);
  }
}

/** A GovTrack list reply must have an `objects` array; anything else is an API change worth reporting. */
export function requireObjects(url: string, j: unknown): unknown {
  const o = j as { objects?: unknown } | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.objects)) throw new Error(`${url.replace(/[?#].*$/, "")}: unexpected reply (no "objects" list)`);
  return j;
}

/** Network-level failure (DNS, TLS, blocked by scope) with the URL attached. */
export const netError = (url: string, e: unknown) =>
  new Error(`could not reach ${url.replace(/[?#].*$/, "")}: ${e instanceof Error ? e.message : String(e)}`);
