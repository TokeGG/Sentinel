// Device-code flow (RFC 8628) decisions, pure. GitHub answers pending polls with
// {error}, Twitch with {message}; both are handled.
export interface DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  /** epoch ms the code stops working. */
  expiresAt: number;
  /** seconds between polls. */
  interval: number;
}

export function parseDeviceStart(body: unknown, now: number): DeviceStart {
  const b = (body ?? {}) as Record<string, unknown>;
  const uri = b.verification_uri ?? b.verification_url;
  if (typeof b.device_code !== "string" || typeof b.user_code !== "string" || typeof uri !== "string") {
    const why = typeof b.error_description === "string" ? b.error_description : typeof b.message === "string" ? b.message : "unexpected response";
    throw new Error(`device sign-in could not start: ${why}`);
  }
  const ttl = Number(b.expires_in);
  const iv = Number(b.interval);
  return { deviceCode: b.device_code, userCode: b.user_code, verificationUri: uri, expiresAt: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : 900) * 1000, interval: Number.isFinite(iv) && iv > 0 ? iv : 5 };
}

export type PollKind = "done" | "pending" | "slow_down" | "denied" | "expired" | "error";

export function classifyPoll(body: unknown): { kind: PollKind; detail?: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.access_token === "string") return { kind: "done" };
  const e = String(b.error ?? b.message ?? "").toLowerCase();
  if (e.includes("authorization_pending")) return { kind: "pending" };
  if (e.includes("slow_down")) return { kind: "slow_down" };
  if (e.includes("access_denied")) return { kind: "denied" };
  if (e.includes("expired")) return { kind: "expired" };
  return { kind: "error", detail: e || "unexpected response" };
}

/** Seconds to wait before the next poll: slow_down adds 5s permanently (RFC 8628 3.5). */
export const nextInterval = (current: number, kind: PollKind): number => (kind === "slow_down" ? current + 5 : current);

/** Formats a user code for display, e.g. ABCD1234 -> ABCD-1234 (codes that already have a dash are kept). */
export const prettyCode = (c: string): string => (/^[A-Z0-9]{8}$/.test(c) ? `${c.slice(0, 4)}-${c.slice(4)}` : c);
