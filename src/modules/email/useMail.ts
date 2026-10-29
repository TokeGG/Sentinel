// State + handlers for the Email panel (kept out of Panel.tsx for size). Network
// calls happen only from handlers the user triggers; the effects below read the cache.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { useModule } from "../../ui/useModule";
import { errorText } from "../../ui/moduleRun";
import { cachedFolders, cachedMessages } from "./cache";
import { buildDraft, emptyDraft, type Draft, type Mode } from "./composeLogic";
import { checkRecipients, formatAddr } from "./addresses";
import { searchMessages, sortMessages } from "./panelLogic";
import { openMessage } from "./sync";
import type { Account, Body, Folder, Msg } from "./types";

export function useMail(module: ModuleManifest) {
  const m = useModule(module);
  const accounts = m.rows as unknown as Account[];
  const [accountId, setAccountId] = useState("");
  const [folder, setFolder] = useState("INBOX");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [query, setQuery] = useState("");
  const [uid, setUid] = useState<number | null>(null);
  const [body, setBody] = useState<Body | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tick, setTick] = useState(0);
  const [local, setLocal] = useState<string | null>(null);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  useEffect(() => { if (account && account.id !== accountId) setAccountId(account.id); }, [account, accountId]);
  useEffect(() => {
    if (!account) { setFolders([]); setMsgs([]); return; }
    let live = true;
    Promise.all([cachedFolders(account.id), cachedMessages(account.id, folder)])
      .then(([f, ms]) => live && (setFolders(f), setMsgs(ms)))
      .catch((e) => live && setLocal(errorText(e)));
    return () => void (live = false);
  }, [account, folder, m.updated, tick]);

  const shown = useMemo(() => searchMessages(sortMessages(msgs), query), [msgs, query]);
  const selected = msgs.find((x) => x.uid === uid) ?? null;

  const pick = useCallback(async (x: Msg) => {
    setUid(x.uid); setBody(null); setLocal(null);
    try { setBody(await openMessage(x.accountId, x.folder, x.uid, x.seen)); } catch (e) { setLocal(errorText(e)); }
    setTick((n) => n + 1);
  }, []);
  const openFolder = (name: string) => {
    setFolder(name); setUid(null); setBody(null); setQuery("");
    if (account) void m.run("refresh", { accountId: account.id, folder: name });
  };
  const flag = (x: Msg, f: "seen" | "flagged", on: boolean) => m.run("set_flag", { accountId: x.accountId, folder: x.folder, uid: x.uid, flag: f, on });
  const remove = async (x: Msg) => { await m.run("remove_message", { accountId: x.accountId, folder: x.folder, uid: x.uid }); setUid(null); setBody(null); };
  const compose = (mode: Mode | "new") => {
    if (mode === "new" || !selected || !account) return setDraft(emptyDraft());
    setDraft(buildDraft(mode, selected, body, account.email));
  };
  const send = async () => {
    if (!draft || !account) return;
    const r = checkRecipients(draft.to, draft.cc, draft.bcc);
    if (r.errors.length) return setLocal(r.errors.join("; "));
    setLocal(null);
    const out = await m.run("send_mail", {
      accountId: account.id, to: r.to.map(formatAddr), cc: r.cc.map(formatAddr), bcc: r.bcc.map(formatAddr),
      subject: draft.subject, body: draft.body, inReplyTo: draft.inReplyTo,
    });
    if (out) setDraft(null);
  };

  return { ...m, error: local ?? m.error, accounts, account, setAccountId, folder, folders, openFolder, shown, total: msgs.length, query, setQuery, selected, body, pick, flag, remove, draft, setDraft, compose, send };
}
