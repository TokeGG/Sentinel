// Pure destiny.gg chat protocol parsing: "COMMAND {json}" frames.
import type { Incoming } from "../types.ts";

export function parseFrame(raw: string): { cmd: string; data: Record<string, unknown> | null } {
  const i = raw.indexOf(" ");
  const cmd = i < 0 ? raw : raw.slice(0, i);
  if (i < 0) return { cmd, data: null };
  try {
    const d = JSON.parse(raw.slice(i + 1));
    return { cmd, data: typeof d === "object" && d !== null ? (d as Record<string, unknown>) : { data: d } };
  } catch {
    return { cmd, data: null };
  }
}

const BADGES = new Set(["admin", "moderator", "protected", "subscriber", "vip", "bot", "broadcaster", "founder"]);

/** MSG / BROADCAST frames -> a message (others null). */
export function dggMessage(cmd: string, d: Record<string, unknown> | null): Incoming | null {
  if (!d || typeof d.data !== "string") return null;
  if (cmd === "BROADCAST") return { user: "", text: d.data, time: Date.now(), kind: "notice" };
  if (cmd !== "MSG" || typeof d.nick !== "string") return null;
  const features = Array.isArray(d.features) ? d.features.map(String) : [];
  const me = /^\/me /.test(d.data);
  return {
    user: d.nick,
    text: me ? d.data.slice(4) : d.data,
    time: typeof d.timestamp === "number" ? d.timestamp : Date.now(),
    kind: me ? "action" : "chat",
    badges: features.filter((f) => BADGES.has(f)),
  };
}

export type DggEvent =
  | { kind: "message"; m: Incoming }
  | { kind: "ping" }
  | { kind: "error"; text: string }
  | { kind: "clear"; user?: string }
  | { kind: "ignore"; cmd: string }
  | { kind: "drop" };

/** One raw frame -> action. Tolerates NAMES/JOIN/QUIT/etc. (ignored), ERR with a json
 *  object, a json string or plain text, and anything that is not "CMD [json]" (dropped). */
export function dggEvent(raw: string): DggEvent {
  const { cmd, data } = parseFrame(raw.trim());
  if (!/^[A-Z]{2,12}$/.test(cmd)) return { kind: "drop" };
  if (cmd === "PING") return { kind: "ping" };
  if (cmd === "ERR") {
    const rest = raw.trim().slice(cmd.length).trim();
    return { kind: "error", text: String(data?.description ?? data?.data ?? (rest || "chat server error")).slice(0, 160) };
  }
  if (cmd === "MUTE" || cmd === "BAN") return { kind: "clear", user: typeof data?.data === "string" ? data.data : undefined };
  if (cmd === "MSG" || cmd === "BROADCAST") {
    const m = dggMessage(cmd, data);
    return m ? { kind: "message", m } : { kind: "drop" };
  }
  return { kind: "ignore", cmd };
}
