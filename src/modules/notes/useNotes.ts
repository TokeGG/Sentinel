// Shared note list for the Notes tabs (one load, reload after writes).
import { useStore } from "../../ui/useStore";
import { listAll } from "./store";
import type { NoteRow } from "./noteLogic";

export const useNotes = () => useStore<NoteRow[]>(listAll, []);
export type NotesStore = ReturnType<typeof useNotes>;
