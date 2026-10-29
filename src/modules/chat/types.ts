// Shared chat types. Pure (no Tauri/React) so connectors' parsers can be tested.

/** An emote the platform itself marked up. start/end are INCLUSIVE code-point
 *  indices into `text` (Twitch's own convention; Kick's are computed to match). */
export interface NativeEmote { name: string; url: string; start: number; end: number }

export interface Incoming {
  user: string;
  text: string;
  time: number;
  kind: "chat" | "action" | "notice";
  color?: string;
  badges?: string[];
  native?: NativeEmote[];
  self?: boolean;
}
export interface Message extends Incoming { id: string; deleted?: boolean }

export type Status = "connecting" | "open" | "closed" | "error";

export interface Handlers {
  onMessage(m: Incoming): void;
  onStatus(s: Status, detail?: string): void;
  /** Twitch room-id etc., used to load channel emote sets. */
  onInfo?(info: { channelId?: string }): void;
  /** A user's messages were removed (ban/timeout); no user = chat cleared. */
  onClear?(user?: string): void;
}

export interface Connection {
  close(): void;
  /** Absent = read-only; `note` then says why. */
  send?(text: string): Promise<void>;
  note?: string;
  /** Own login, for @mention highlighting. */
  nick?: string;
}

export interface RoomRef { site: string; target: string; label: string }
export interface Room extends RoomRef { id: string; position: number; pinned: boolean }

export interface Connector {
  id: string;
  label: string;
  color: string;
  placeholder: string;
  parseRoom(input: string): RoomRef | null;
  /** Absent for `embed`: the site renders its own chat in an iframe. */
  connect?(room: RoomRef, h: Handlers): Promise<Connection>;
  /** Embed-only sites whose room target is not itself a URL: iframe src and own-panel URL. */
  urls?(room: RoomRef, host: string): { frame: string; panel: string };
  auth?: { credentialKey: string; help: string };
}
