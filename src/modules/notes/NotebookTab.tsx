// Notebook tab: list on the left, the open note on the right; markdown export of everything.
import { EmptyState, ErrorLine } from "../../ui/kit";
import { Editor } from "./Editor";
import { ExportBar } from "./ExportBar";
import { NoteList } from "./NoteList";
import { allMarkdown } from "./exportMd";
import { createNote } from "./store";
import type { NotesStore } from "./useNotes";

export function NotebookTab({ store, openId, setOpenId }: { store: NotesStore; openId: number | null; setOpenId(id: number | null): void }) {
  const note = store.data.find((n) => n.id === openId) ?? null;
  const onNew = (body: string, folder: string) =>
    void store.act(async () => { const id = await createNote(body, folder); setOpenId(id); });
  return (
    <div className="nt-book">
      {store.error && <ErrorLine message={store.error} />}
      <div>
        <NoteList notes={store.data} openId={openId} onOpen={setOpenId} onNew={onNew} />
        <ExportBar label="Export all as .md" filename="notes.md" text={() => allMarkdown(store.data.filter((n) => !n.archived))} />
      </div>
      {note ? <Editor note={note} notes={store.data} act={store.act} onOpen={setOpenId} /> : <EmptyState title="No note open" hint="Pick a note or start a new one." />}
    </div>
  );
}
