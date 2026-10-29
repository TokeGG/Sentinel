import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ModuleManifest } from "../../core/module";
import { CredentialFields } from "../../core/panel/CredentialFields";
import { EmptyState, ErrorLine, Tile } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { AddRoom } from "./AddRoom";
import { connectorOf } from "./connectors";
import { twitch } from "./connectors/twitch";
import { visibleRooms, toRooms } from "./panelLogic";
import type { RoomState } from "./types";
import { RoomTabs } from "./RoomTabs";
import { RoomView } from "./RoomView";
import { FiltersTool, LogsTool } from "./ChatTools";
import { PrefsCtx, useChatPrefs } from "./prefsContext";
import "./chat.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const mode = useOption<string>("view", "tabs");
  const cols = useOption("columns", 2);
  const stamp = useOption("timestamps", false);
  const cap = useOption("cap", 500);
  const prefs = useChatPrefs(useOption("logs", false), useOption("logCap", 5000), useOption("players", false));
  const rooms = useMemo(() => toRooms(rows), [rows]);
  const [active, setActive] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [states, setStates] = useState<Record<string, RoomState>>({});
  const [fb, setFb] = useState<Set<string>>(new Set());
  const [epoch, setEpoch] = useState(0); // bumped when the Twitch token is saved
  const activeId = rooms.some((r) => r.id === active) ? active : (rooms[0]?.id ?? "");
  const shown = useMemo(() => new Set(visibleRooms(rooms, mode, activeId).map((r) => r.id)), [rooms, mode, activeId]);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // Another panel (YouTube "Chat") added a room: reload and jump to it.
  useEffect(() => {
    const un = listen<{ id?: string }>("chat-rooms-changed", (e) => {
      void refresh();
      if (e.payload?.id) setActive(e.payload.id);
    });
    return () => void un.then((f) => f()).catch(() => {});
  }, [refresh]);

  useEffect(() => setUnread((u) => (Object.keys(u).some((k) => shown.has(k)) ? Object.fromEntries(Object.entries(u).filter(([k]) => !shown.has(k))) : u)), [shown]);
  const bump = useCallback((id: string) => {
    if (!shownRef.current.has(id)) setUnread((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }));
  }, []);

  return (
    <PrefsCtx.Provider value={prefs}>
    <div className="chat-root">
      <h2 className="ui-head chat-bar">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{rooms.length} room{rooms.length === 1 ? "" : "s"}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections className="chat-sections">
        <Section id="tabs">
          <div className="chat-tabs">
            <RoomTabs rooms={rooms} shown={shown} unread={unread} busy={busy} states={states} fallback={fb} onSelect={setActive} onAct={(skill, id, dir) => void run(skill, { id, dir })} />
            <AddRoom busy={busy} onAdd={(input, site, chatroom) => run("add_room", { input, site, chatroom })} />
          </div>
        </Section>
        <Section id="rooms">
          {rooms.length === 0 ? (
            <EmptyState title="No rooms yet" hint="Press + and paste a Twitch, Kick or destiny.gg URL, or any chat popout URL (e.g. iCanHazChat, YouTube or Rumble chat) to embed it." />
          ) : (
            <div className={`chat-body ${mode === "columns" ? "cols" : "tabs"}`} style={{ "--chat-cols": Math.min(cols, Math.max(1, shown.size)) } as React.CSSProperties}>
              {rooms.map((r) => (
                <div key={r.id} className="chat-room" hidden={!shown.has(r.id)}>
                  {mode === "columns" && <div className="chat-room-head"><i className="chat-dot" style={{ background: connectorOf(r.site).color }} />{r.label}</div>}
                  <RoomView room={r} cap={cap} stamp={stamp} epoch={epoch} visible={shown.has(r.id)} fallback={fb.has(r.id)} onActivity={() => bump(r.id)}
                    onState={(s) => setStates((m) => (m[r.id]?.status === s.status && m[r.id]?.detail === s.detail ? m : { ...m, [r.id]: s }))}
                    onFallback={(on) => setFb((f) => { const n = new Set(f); if (on) n.add(r.id); else n.delete(r.id); return n; })} />
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section id="filters"><Tile title="Ignore list, word filters, highlights"><FiltersTool /></Tile></Section>
        <Section id="logs"><Tile title="Chat logs"><LogsTool /></Tile></Section>
        <Section id="login">
          <Tile title="Twitch login (to send)">
            <p className="chat-help">{twitch.auth!.help}</p>
            <p className="chat-help">Kick and destiny.gg open as their own embedded chat (log in and send there); "Try native" uses the read-only live socket. Other embedded sites handle their own login and sending.</p>
            <CredentialFields module={module} onSaved={() => setEpoch((e) => e + 1)} />
          </Tile>
        </Section>
      </Sections>
    </div>
    </PrefsCtx.Provider>
  );
}
