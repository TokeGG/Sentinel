// Pure helpers for the local-model picker (Ollama on this machine only).
export const OLLAMA_TAGS_URL = "http://127.0.0.1:11434/api/tags";

/** http(s) to loopback only: the picker never talks to a remote host. */
export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

export interface LocalModel { name: string; size: number }
export function parseTags(json: unknown): LocalModel[] {
  const list = (json as { models?: unknown })?.models;
  if (!Array.isArray(list)) return [];
  return list
    .flatMap((m: { name?: unknown; size?: unknown }) => (typeof m?.name === "string" && m.name && m.name.length <= 200 ? [{ name: m.name, size: Number(m.size) || 0 }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
}
