// Document vault: only .txt/.md/.html get text extracted (searchable); PDFs are stored and found by name/tags only.
import { htmlToText } from "./clipper.ts";

export type VaultKind = "text" | "pdf";
export const MAX_VAULT_BYTES = 2_000_000;

export function classifyFile(name: string): VaultKind | null {
  const e = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return e && ["txt", "md", "markdown", "html", "htm"].includes(e) ? "text" : e === "pdf" ? "pdf" : null;
}

export const extractText = (name: string, raw: string) => (/\.html?$/i.test(name) ? htmlToText(raw) : raw);

export type VaultDoc = { id: number; name: string; kind: string; text: string; tags: string; size: number };

/** Every term must hit the name or tags (any doc) or the text (text docs only). */
export function searchVault<T extends VaultDoc>(docs: T[], q: string): T[] {
  const ts = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ts.length) return docs;
  return docs.filter((d) => {
    const hay = `${d.name} ${d.tags} ${d.kind === "text" ? d.text : ""}`.toLowerCase();
    return ts.every((t) => hay.includes(t));
  });
}
