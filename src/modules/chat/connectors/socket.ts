// WebSocket with auto-reconnect (capped backoff) for the socket connectors.
// Runs only while the panel is open: close() stops it for good.
import { backoffMs, closeHint } from "../connLog.ts";
import type { Handlers } from "../types.ts";

export interface Sock { send(data: string): void; close(): void }
export interface SockOpts {
  url: string;
  onOpen(s: Sock): void;
  onData(data: string, s: Sock): void;
  keepalive?: { everyMs: number; data: string };
}

/** Consecutive failed dials (never opened) before giving up until the user presses Retry. */
export const MAX_TRIES = 8;

export function openSocket(o: SockOpts, h: Pick<Handlers, "onStatus" | "log">): Sock {
  const log = h.log ?? (() => {});
  let ws: WebSocket | null = null;
  let stop = false;
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ka: ReturnType<typeof setInterval> | undefined;
  const sock: Sock = {
    send: (d) => ws?.readyState === WebSocket.OPEN && ws.send(d),
    close() {
      stop = true;
      clearTimeout(timer);
      clearInterval(ka);
      ws?.close();
    },
  };
  const dial = () => {
    h.onStatus("connecting");
    let opened = false;
    log(`websocket connecting to ${new URL(o.url).host}`);
    ws = new WebSocket(o.url);
    ws.onopen = () => {
      opened = true;
      tries = 0;
      log("websocket open");
      h.onStatus("open");
      o.onOpen(sock);
      if (o.keepalive) ka = setInterval(() => sock.send(o.keepalive!.data), o.keepalive.everyMs);
    };
    ws.onmessage = (e) => typeof e.data === "string" && o.onData(e.data, sock);
    ws.onerror = () => {
      log("websocket error (the browser gives no detail)");
      h.onStatus("error", "connection error");
    };
    ws.onclose = (e) => {
      clearInterval(ka);
      log(`websocket closed: code ${e.code}${e.reason ? ` reason "${e.reason}"` : ""} (${closeHint(e.code)})${opened ? "" : ", never opened"}`);
      if (stop) return h.onStatus("closed");
      if (++tries >= MAX_TRIES) {
        log(`giving up after ${tries} failed attempts`);
        return h.onStatus("error", `Could not connect (last close code ${e.code}: ${closeHint(e.code)}). Press Retry, or use the embed.`);
      }
      const wait = backoffMs(tries - 1);
      log(`reconnect attempt ${tries} in ${wait / 1000}s`);
      h.onStatus("closed", `Disconnected (code ${e.code}), reconnecting in ${wait / 1000}s...`);
      timer = setTimeout(dial, wait);
    };
  };
  dial();
  return sock;
}
