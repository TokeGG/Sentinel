import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ModuleManifest } from "../../core/module";
import { CredentialFields } from "../../core/panel/CredentialFields";
import { EmptyState, ErrorLine, Tile } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useOption } from "../../ui/useOption";
import { useModule } from "../../ui/useModule";
import { AddRoom } from "./AddRoom";
import { twitch } from "./connectors/twitch";
import { visibleRooms, toRooms } from "./panelLogic";
import { RoomTabs } from "./RoomTabs";
import { RoomView } from "./RoomView";
import "./chat.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const mode = useOption<string>("view", "tabs");
  const cols = useOption("columns", 2);
  const stamp = useOption("timestamps", false);
  const cap = useOption("cap", 500);
  const rooms = useMemo(() => toRooms(rows), [rows]);
  const [active, setActive] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});
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
    <>
      <h2 className="ui-head">
        <span className="ui-dot" />
        {module.name}
        <span className="ui-count">{rooms.length} room{rooms.length === 1 ? "" : "s"}</span>
      </h2>
      {error && <ErrorLine message={error} />}
      <Sections className="chat-sections">
        <Section id="tabs">
          <div className="chat-tabs">
            <RoomTabs rooms={rooms} shown={shown} unread={unread} busy={busy} onSelect={setActive} onAct={(skill, id, dir) => void run(skill, { id, dir })} />
            <AddRoom busy={busy} onAdd={(input, site) => run("add_room", { input, site })} />
          </div>
        </Section>
        <Section id="rooms">
          {rooms.length === 0 ? (
            <EmptyState title="No rooms yet" hint="Press + and paste a Twitch, Kick or destiny.gg URL, or any chat popout URL (e.g. iCanHazChat, YouTube or Rumble chat) to embed it." />
          ) : (
            <div className={`chat-body ${mode === "columns" ? "cols" : "tabs"}`} style={{ "--chat-cols": Math.min(cols, Math.max(1, shown.size)) } as React.CSSProperties}>
              {rooms.map((r) => (
                <div key={r.id} className="chat-room" hidden={!shown.has(r.id)}>
                  {mode === "columns" && <div className="chat-room-head">{r.label}</div>}
                  <RoomView room={r} cap={cap} stamp={stamp} epoch={epoch} visible={shown.has(r.id)} onActivity={() => bump(r.id)} />
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section id="login">
          <Tile title="Twitch login (to send)">
            <p className="chat-help">{twitch.auth!.help}</p>
            <p className="chat-help">Kick and destiny.gg are read-only here; embedded sites handle their own login and sending.</p>
            <CredentialFields module={module} onSaved={() => setEpoch((e) => e + 1)} />
          </Tile>
        </Section>
      </Sections>
    </>
  );
}
