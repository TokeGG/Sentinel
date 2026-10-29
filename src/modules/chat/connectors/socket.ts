// WebSocket with auto-reconnect (capped backoff) for the socket connectors.
// Runs only while the panel is open: close() stops it for good.
import type { Handlers } from "../types.ts";

export interface Sock { send(data: string): void; close(): void }
export interface SockOpts {
  url: string;
  onOpen(s: Sock): void;
  onData(data: string, s: Sock): void;
  keepalive?: { everyMs: number; data: string };
}

export function openSocket(o: SockOpts, h: Pick<Handlers, "onStatus">): Sock {
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
    ws = new WebSocket(o.url);
    ws.onopen = () => {
      tries = 0;
      h.onStatus("open");
      o.onOpen(sock);
      if (o.keepalive) ka = setInterval(() => sock.send(o.keepalive!.data), o.keepalive.everyMs);
    };
    ws.onmessage = (e) => typeof e.data === "string" && o.onData(e.data, sock);
    ws.onerror = () => h.onStatus("error", "connection error");
    ws.onclose = () => {
      clearInterval(ka);
      if (stop) return h.onStatus("closed");
      h.onStatus("closed", "reconnecting…");
      timer = setTimeout(dial, Math.min(30_000, 1000 * 2 ** tries++));
    };
  };
  dial();
  return sock;
}
