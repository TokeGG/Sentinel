// State + handlers for the Email panel (kept out of Panel.tsx for size). Network
// calls happen only from handlers the user triggers; the effects below read the cache.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { useModule } from "../../ui/useModule";
import { errorText } from "../../ui/moduleRun";
import { cachedFolders, cachedMessages, cachedSnoozed, cachedUnified } from "./cache";
import { buildDraft, emptyDraft, type Draft, type Mode } from "./composeLogic";
import { checkRecipients, formatAddr } from "./addresses";
import { searchMessages, sortMessages, VIRTUAL, visibleNow } from "./panelLogic";
import { msgKey, threadMsgs } from "./threads";
import { openMessage } from "./sync";
import { useMailExtras } from "./useMailExtras";
import { draftEmpty, type StoredDraft } from "./mailExtras";
import { saveDraft } from "./extrasStore";
import type { Account, Body, Folder, Msg } from "./types";

const loadFor = (accountId: string, folder: string) =>
  folder === VIRTUAL.unified ? cachedUnified() : folder === VIRTUAL.snoozed ? cachedSnoozed() : folder === VIRTUAL.drafts ? Promise.resolve([]) : cachedMessages(accountId, folder);

export function useMail(module: ModuleManifest) {
  const m = useModule(module);
  const accounts = m.rows as unknown as Account[];
  const [accountId, setAccountId] = useState("");
  const [folder, setFolder] = useState("INBOX");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [query, setQuery] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [body, setBody] = useState<Body | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftId, setDraftId] = useState("");
  const [threaded, setThreaded] = useState(true);
  const [tick, setTick] = useState(0);
  const [local, setLocal] = useState<string | null>(null);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const ex = useMailExtras(tick, draft, draftId, account?.id ?? "");

  useEffect(() => { if (account && account.id !== accountId) setAccountId(account.id); }, [account, accountId]);
  useEffect(() => {
    if (!account) { setFolders([]); setMsgs([]); return; }
    let live = true;
    Promise.all([cachedFolders(account.id), loadFor(account.id, folder)])
      .then(([f, ms]) => live && (setFolders(f), setMsgs(ms)))
      .catch((e) => live && setLocal(errorText(e)));
    return () => void (live = false);
  }, [account, folder, m.updated, tick]);

  const visible = useMemo(() => searchMessages(sortMessages(visibleNow(msgs, ex.snooze, folder, Date.now() / 1000)), query), [msgs, ex.snooze, folder, query]);
  const threads = useMemo(() => threadMsgs(visible, ex.meta), [visible, ex.meta]);
  const shown = threaded ? threads.map((t) => t.latest) : visible;
  const counts = useMemo(() => new Map(threads.map((t) => [msgKey(t.latest), t.msgs.length])), [threads]);
  const selected = msgs.find((x) => msgKey(x) === key) ?? null;
  const thread = selected ? threads.find((t) => t.msgs.some((x) => msgKey(x) === key))?.msgs ?? [selected] : [];
  const msgAccount = (x: Msg | null) => accounts.find((a) => a.id === x?.accountId) ?? account;

  const pick = useCallback(async (x: Msg) => {
    setKey(msgKey(x)); setBody(null); setLocal(null);
    try { setBody(await openMessage(x.accountId, x.folder, x.uid, x.seen)); } catch (e) { setLocal(errorText(e)); }
    setTick((n) => n + 1);
  }, []);
  const openFolder = (name: string) => {
    setFolder(name); setKey(null); setBody(null); setQuery("");
    if (account && !name.startsWith("__")) void m.run("refresh", { accountId: account.id, folder: name });
  };
  const flag = (x: Msg, f: "seen" | "flagged", on: boolean) => m.run("set_flag", { accountId: x.accountId, folder: x.folder, uid: x.uid, flag: f, on });
  const remove = async (x: Msg) => { await m.run("remove_message", { accountId: x.accountId, folder: x.folder, uid: x.uid }); setKey(null); setBody(null); };
  const startDraft = (d: Draft, id: string = crypto.randomUUID()) => { setDraft(d); setDraftId(id); };
  const compose = (mode: Mode | "new") => {
    const a = msgAccount(selected);
    if (mode === "new" || !selected || !a) return startDraft(emptyDraft());
    startDraft(buildDraft(mode, selected, body, a.email));
  };
  const resume = (d: StoredDraft) => { if (d.accountId !== account?.id) setAccountId(d.accountId); startDraft(d, d.id); };
  const discard = async () => { if (draftId) await ex.dropDraft(draftId); setDraft(null); };
  const send = async () => {
    if (!draft || !account) return;
    const r = checkRecipients(draft.to, draft.cc, draft.bcc);
    if (r.errors.length) return setLocal(r.errors.join("; "));
    setLocal(null);
    const out = await m.run("send_mail", {
      accountId: account.id, to: r.to.map(formatAddr), cc: r.cc.map(formatAddr), bcc: r.bcc.map(formatAddr),
      subject: draft.subject, body: draft.body, inReplyTo: draft.inReplyTo,
    });
    if (out) await discard();
  };
  const close = () => {
    if (draft && draftId && account && !draftEmpty(draft)) void saveDraft({ ...draft, id: draftId, accountId: account.id, updatedAt: Math.floor(Date.now() / 1000) }).then(ex.reload);
    setDraft(null);
  };
  const reload = () => { setTick((n) => n + 1); ex.reload(); };

  return { ...m, error: local ?? m.error, setLocal, accounts, account, setAccountId, folder, folders, openFolder, shown, counts, threaded, setThreaded, thread, total: msgs.length, query, setQuery, selected, selKey: key, body, pick, flag, remove, draft, setDraft, compose, close, resume, discard, send, ex, msgAccount, reload };
}
