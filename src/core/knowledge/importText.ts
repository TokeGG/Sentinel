// Course notes / PDF text import (pure): split pasted or file text into knowledge-base sized chunks.
import { MAX_BODY } from "./kbLogic.ts";

export function chunkText(text: string, title: string, size = 3000): { title: string; body: string }[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const max = Math.min(size, MAX_BODY), out: string[] = [];
  let cur = "";
  for (const p of clean.split(/\n\n/)) {
    for (let piece = p; piece; piece = piece.slice(max)) {
      const part = piece.slice(0, max);
      if (cur && cur.length + part.length + 2 > max) { out.push(cur); cur = ""; }
      cur = cur ? `${cur}\n\n${part}` : part;
      if (piece.length <= max) break;
    }
  }
  if (cur) out.push(cur);
  const t = title.trim() || "Imported notes";
  return out.slice(0, 200).map((body, i) => ({ title: out.length > 1 ? `${t} (${i + 1}/${out.length})` : t, body }));
}
