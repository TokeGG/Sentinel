// Extras state for the Email panel: thread/unsubscribe meta, snoozes, rules, local
// drafts, contact pool. Reads SQLite only; network calls live in extrasSync.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { contactSources, deleteDraft, listDrafts, listRules, loadMeta, saveDraft, setSnooze, snoozes } from "./extrasStore";
import { contactPool, draftEmpty, type StoredDraft } from "./mailExtras";
import type { Rule } from "./rules";
import type { ThreadMeta } from "./threads";
import type { Draft } from "./composeLogic";
import { useDebounced } from "../../ui/useDebounced";
import type { Msg } from "./types";

export function useMailExtras(tick: number, draft: Draft | null, draftId: string, accountId: string) {
  const [meta, setMeta] = useState<Map<string, ThreadMeta & { unsub: string }>>(new Map());
  const [snooze, setSnoozeMap] = useState<Map<string, number>>(new Map());
  const [rules, setRules] = useState<Rule[]>([]);
  const [drafts, setDrafts] = useState<StoredDraft[]>([]);
  const [src, setSrc] = useState<{ contacts: { name: string; emails: string }[]; sentTo: string[] }>({ contacts: [], sentTo: [] });
  const [v, setV] = useState(0);
  const bump = useCallback(() => setV((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([loadMeta(), snoozes(), listRules(), listDrafts(), contactSources()]).then(([m, s, r, d, c]) => {
      if (live) { setMeta(m); setSnoozeMap(s); setRules(r); setDrafts(d); setSrc(c); }
    }).catch(() => {});
    return () => void (live = false);
  }, [tick, v]);

  // Draft autosave: local only, 1.5 s after typing stops; empty drafts are not stored.
  const settled = useDebounced(draft, 1500);
  useEffect(() => {
    if (!settled || !draftId || !accountId || draftEmpty(settled)) return;
    void saveDraft({ ...settled, id: draftId, accountId, updatedAt: Math.floor(Date.now() / 1000) }).then(bump).catch(() => {});
  }, [settled, draftId, accountId, bump]);

  const pool = useMemo(() => contactPool(src.contacts, src.sentTo), [src]);
  const snoozeMsg = async (m: Msg, until: number | null) => { await setSnooze(m.accountId, m.folder, m.uid, until); bump(); };
  const dropDraft = async (id: string) => { await deleteDraft(id); bump(); };
  return { meta, snooze, rules, drafts, pool, snoozeMsg, dropDraft, reload: bump };
}
