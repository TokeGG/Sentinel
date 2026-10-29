// Pure emote resolver: message text + native ranges + third-party sets -> segments.
import type { NativeEmote } from "./types.ts";

export interface EmoteDef { url: string; zeroWidth?: boolean }
/** name -> emote. Case-sensitive, like the emote sites themselves. */
export type EmoteSet = Map<string, EmoteDef>;
export type Segment = { t: "text"; text: string } | { t: "emote"; name: string; url: string; zeroWidth?: boolean };

/** Merge sets; earlier sets win a name clash (pass channel sets before global ones). */
export function mergeSets(...sets: EmoteSet[]): EmoteSet {
  const out: EmoteSet = new Map();
  for (const s of sets) for (const [k, v] of s) if (!out.has(k)) out.set(k, v);
  return out;
}

function pushText(out: Segment[], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.t === "text") last.text += text;
  else out.push({ t: "text", text });
}

/** Words of `text` that are third-party emotes become emote segments. */
function words(text: string, set: EmoteSet, out: Segment[]) {
  for (const part of text.split(/(\s+)/)) {
    const e = part && !/^\s+$/.test(part) ? set.get(part) : undefined;
    if (e) out.push({ t: "emote", name: part, url: e.url, zeroWidth: e.zeroWidth });
    else pushText(out, part);
  }
}

/** `native` ranges are inclusive code-point indices (overlapping/out-of-range ones are skipped). */
export function tokenize(text: string, native: NativeEmote[], set: EmoteSet): Segment[] {
  const cps = Array.from(text);
  const out: Segment[] = [];
  let pos = 0;
  for (const e of [...native].sort((a, b) => a.start - b.start)) {
    if (e.start < pos || e.end < e.start || e.end >= cps.length) continue;
    words(cps.slice(pos, e.start).join(""), set, out);
    out.push({ t: "emote", name: e.name, url: e.url });
    pos = e.end + 1;
  }
  words(cps.slice(pos).join(""), set, out);
  return out;
}
