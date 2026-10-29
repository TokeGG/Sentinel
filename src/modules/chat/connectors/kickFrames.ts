// Pure Kick/Pusher frame handling: one raw frame -> what the connector should do.
import type { Incoming } from "../types.ts";
import { KICK_BAN_EVENT, KICK_MESSAGE_EVENT, kickMessage, pusherData } from "./kickParse.ts";

export interface KickAct { send?: string; message?: Incoming; clear?: { user?: string }; error?: string; log?: string; drop?: boolean }

export function kickFrame(raw: string, channel: string): KickAct {
  const e = pusherData(raw);
  if (!e) return { drop: true };
  switch (e.event) {
    case "pusher:connection_established":
      return { send: JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel } }), log: `pusher:connection_established, subscribing to ${channel}` };
    case "pusher:ping":
      return { send: '{"event":"pusher:pong","data":{}}', log: "pusher:ping -> pusher:pong" };
    case "pusher:pong":
      return {};
    case "pusher:subscription_succeeded":
    case "pusher_internal:subscription_succeeded":
      return { log: `subscription succeeded (${channel})` };
    case "pusher:error":
      return { error: `Pusher error: ${JSON.stringify(e.data).slice(0, 160)}`, log: `pusher:error ${JSON.stringify(e.data).slice(0, 160)}` };
    case KICK_MESSAGE_EVENT: {
      const m = e.data && kickMessage(e.data);
      return m ? { message: m } : { drop: true };
    }
    case KICK_BAN_EVENT:
      return { clear: { user: (e.data?.user as { username?: string } | undefined)?.username } };
    default:
      return {};
  }
}
