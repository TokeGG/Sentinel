import { getDb, logActivity } from "../../core/db";
import { registerModule, type ModuleManifest } from "../../core/module";

interface Note extends Record<string, unknown> {
  id: number;
  body: string;
  tags: string | null;
  filed_to: string | null;
  created_at: string;
}

async function captureNote(args?: Record<string, unknown>) {
  const body = String(args?.body ?? "").trim();
  if (!body) throw new Error("note body is empty");
  const d = await getDb();
  await d.execute("INSERT INTO notes (body, tags) VALUES ($1, $2)", [
    body,
    args?.tags ? String(args.tags) : null,
  ]);
  await logActivity("notes", "capture_note", "captured a note", "ok");
  return { ok: true };
}

async function fileNote(args?: Record<string, unknown>) {
  const id = Number(args?.id);
  const filedTo = String(args?.filed_to ?? "");
  const d = await getDb();
  await d.execute("UPDATE notes SET filed_to = $1 WHERE id = $2", [filedTo, id]);
  await logActivity("notes", "file_note", `filed note #${id} to ${filedTo}`, "ok");
  return { ok: true };
}

async function loadNotes(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  return await d.select<Note[]>(
    "SELECT * FROM notes ORDER BY created_at DESC LIMIT 200"
  );
}

export const notesModule: ModuleManifest = {
  id: "hub.notes",
  name: "Notes",
  description: "Quick-capture inbox — untagged until you file it.",
  panel: "list",
  skills: [
    { name: "capture_note", run: captureNote },
    { name: "file_note", run: fileNote },
  ],
  load: loadNotes,
  quickAdd: { skill: "capture_note", argName: "body", placeholder: "Capture a note…" },
};

registerModule(notesModule);
