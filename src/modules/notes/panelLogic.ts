// Pure helpers for the Notes panel.
import type { TabDef } from "../../ui/sectionTabsLogic.ts";
type Row = Record<string, unknown>;

/** Unfiled = no (or blank) filed_to; order is preserved. */
export function splitFiled<T extends Row>(rows: T[]): { unfiled: T[]; filed: T[] } {
  const unfiled: T[] = [];
  const filed: T[] = [];
  for (const r of rows) {
    (typeof r.filed_to === "string" && r.filed_to.trim() ? filed : unfiled).push(r);
  }
  return { unfiled, filed };
}

/** Customize sections for the Notes panel; Panel.tsx renders exactly these ids. */
export const notesSections = [
  { id: "capture", label: "Capture box" },
  { id: "inbox", label: "Unfiled notes" },
  { id: "filed", label: "Filed notes", default: false },
  { id: "editor", label: "Notebook (editor, search, folders)" },
  { id: "journal", label: "Journal (daily note, prompts, on this day)" },
  { id: "graph", label: "Link graph" },
  { id: "cards", label: "Flashcards" },
  { id: "snippets", label: "Snippets" },
  { id: "vault", label: "Document vault" },
  { id: "clipper", label: "Web clipper" },
];

/** Panel tabs: each groups section ids above. */
export const NOTES_TABS: TabDef[] = [
  { id: "inbox", label: "Inbox", sections: ["capture", "inbox", "filed"] },
  { id: "notebook", label: "Notebook", sections: ["editor"] },
  { id: "journal", label: "Journal", sections: ["journal"] },
  { id: "graph", label: "Graph", sections: ["graph"] },
  { id: "cards", label: "Cards", sections: ["cards"] },
  { id: "snippets", label: "Snippets", sections: ["snippets"] },
  { id: "vault", label: "Vault", sections: ["vault"] },
  { id: "clip", label: "Clip", sections: ["clipper"] },
];

/** app_settings key: "1" = create today's daily note when the panel opens (opt-in). */
export const DAILY_KEY = "notes_daily";
