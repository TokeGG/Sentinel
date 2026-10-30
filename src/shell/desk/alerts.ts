// Main window: turns count increases into toasts/sounds per notif_policy
// (vacation, focus session, digest, hourly limit, count-only text, per-module
// WebAudio tone). Toasts still need the opt-in `notif_toasts`.
import { registry } from "../../core/module";
import { getSetting, setSetting } from "../../ui/appSetting";
import type { Badges } from "../badges";
import { totalOf } from "../notifLogic";
import { decideAlert, digestDue, pruneHour, sanitizePolicy, toastText, TONE_NOTES, type NotifPolicy, type Tone } from "../notifPolicy";

let policy: NotifPolicy = sanitizePolicy(null);
let sent: number[] = [];
let pending = 0; // digest backlog
export async function loadPolicy() {
  try { policy = sanitizePolicy(JSON.parse((await getSetting("notif_policy")) ?? "null")); } catch { policy = sanitizePolicy(null); }
}

let ctx: AudioContext | null = null;
export function playTone(t: Tone) {
  if (t === "off" || typeof AudioContext === "undefined") return;
  ctx ??= new AudioContext();
  let at = ctx.currentTime;
  for (const [f, d] of TONE_NOTES[t]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; g.gain.setValueAtTime(0.15, at); g.gain.exponentialRampToValueAtTime(0.001, at + d);
    o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + d); at += d;
  }
}
function notify(body: string) {
  if (typeof Notification === "undefined") return;
  const show = () => new Notification("Sentinel", { body, silent: true });
  if (Notification.permission === "granted") show();
  else if (Notification.permission !== "denied") Notification.requestPermission().then((p) => p === "granted" && show());
}

/** Called on every shown-count change. */
export async function onCountsChanged(prev: Badges, next: Badges, toasts: boolean, muted: boolean) {
  const up = Object.keys(next).filter((id) => (next[id] ?? 0) > (prev[id] ?? 0));
  const now = Date.now();
  if (!muted && policy.digest.on && pending > 0 && digestDue(policy, new Date(), Number((await getSetting("notif_digest_last")) ?? 0))) {
    if (toasts) notify(`Daily digest: ${pending} new notification${pending === 1 ? "" : "s"} (${totalOf(next)} unread)`);
    pending = 0;
    await setSetting("notif_digest_last", String(now));
  }
  if (!up.length || muted) return;
  sent = pruneHour(sent, now);
  const d = decideAlert(policy, up, now, sent.length);
  if (d === "drop") return;
  const n = up.reduce((t, id) => t + (next[id] - (prev[id] ?? 0)), 0);
  if (d === "digest") { pending += n; return; }
  for (const id of up) { const t = policy.sounds[id]; if (t) { playTone(t); break; } }
  if (!toasts) return;
  sent.push(now);
  notify(toastText(policy, n, totalOf(next), up.map((id) => registry.find((m) => m.id === id)?.name ?? id)));
}
