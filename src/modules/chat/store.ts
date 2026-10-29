// DB side of the chat module: the user's rooms (re-opened whenever the panel opens).
import { getDb, logActivity } from "../../core/db";
import { detectRoom } from "./connectors/rooms";
import { moved } from "./panelLogic";

type Row = Record<string, unknown>;

export async function addRoom(args?: Record<string, unknown>) {
  const ref = detectRoom(String(args?.input ?? ""), String(args?.site ?? "auto"));
  if (!ref) throw new Error("not recognised: paste a Twitch/Kick/destiny.gg URL, a chat popout URL, or pick a site and type a channel name");
  const d = await getDb();
  const id = `${ref.site}:${ref.target}`;
  const r = await d.execute(
    "INSERT OR IGNORE INTO chat_rooms (id, site, target, label, position) VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), 0) + 1 FROM chat_rooms))",
    [id, ref.site, ref.target, ref.label]
  );
  if (r.rowsAffected) await logActivity("chat", "add_room", ref.label, ref.site);
  return { ok: true, id };
}

export async function removeRoom(args?: Record<string, unknown>) {
  await (await getDb()).execute("DELETE FROM chat_rooms WHERE id = $1", [String(args?.id ?? "")]);
  return { ok: true };
}

export async function moveRoom(args?: Record<string, unknown>) {
  const d = await getDb();
  const ids = (await d.select<Row[]>("SELECT id FROM chat_rooms ORDER BY position, id")).map((r) => String(r.id));
  const next = moved(ids, String(args?.id ?? ""), args?.dir === -1 ? -1 : 1);
  for (let i = 0; i < next.length; i++) await d.execute("UPDATE chat_rooms SET position = $1 WHERE id = $2", [i + 1, next[i]]);
  return { ok: true };
}

export async function pinRoom(args?: Record<string, unknown>) {
  await (await getDb()).execute("UPDATE chat_rooms SET pinned = 1 - pinned WHERE id = $1", [String(args?.id ?? "")]);
  return { ok: true };
}

export async function loadRooms(): Promise<Row[]> {
  return (await getDb()).select<Row[]>("SELECT * FROM chat_rooms ORDER BY position, id");
}
