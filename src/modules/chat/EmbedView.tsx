import { openWebPanel } from "../../shell/panelApi";
import { connectorOf } from "./connectors";
import { webPanelRef } from "./panelLogic";
import type { RoomRef } from "./types";

// Any chat site as an iframe. The site draws its own chat, emotes and send box
// (this app adds none). If it forbids framing (X-Frame-Options) the frame stays
// blank: "Open as its own panel" then loads it as a web panel instead.
export function EmbedView({ room }: { room: RoomRef }) {
  const u = connectorOf(room.site).urls?.(room, window.location.hostname);
  const frame = u?.frame ?? room.target;
  const panel = u?.panel ?? room.target;
  const ref = webPanelRef(panel);
  return (
    <>
      <iframe className="chat-frame" src={frame} title={room.label} referrerPolicy="no-referrer" allow="clipboard-write; fullscreen" />
      <div className="chat-note">
        Embedded site: it shows its own emotes and send box. Blank?{" "}
        <button type="button" className="ui-btn" onClick={() => void openWebPanel(ref.id, panel, ref.profile).catch(() => {})}>
          Open as its own panel
        </button>
      </div>
    </>
  );
}
