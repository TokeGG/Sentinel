// Network + cache operations behind the Email skills. Every call is a direct user
// action (or the opt-in scheduled refresh); nothing here runs on its own.
import { invoke } from "@tauri-apps/api/core";
import { logActivity } from "../../core/db";
import { connFor, listAccounts } from "./accounts";
import { cachedBody, cachedFolders, cachedUids, dropMessages, saveBody, saveFolders, setCachedFlag, upsertMessages } from "./cache";
import { folderOfRole, folderRole, sortFolders } from "./folders";
import { savesSentCopy } from "./presets";
import { staleUids } from "./panelLogic";
import type { Account, Body, Folder, Msg } from "./types";
import { saveMeta } from "./extrasStore";
import { applyRules } from "./extrasSync";

export const PAGE = 50;
interface RawHeader { messageId: string; inReplyTo: string; refs: string; unsub: string; uid: number; fromName: string; fromAddr: string; to: string; subject: string; dateTs: number; preview: string; seen: boolean; starred: boolean; answered: boolean; hasAttach: boolean }

export async function acctById(id: string): Promise<Account> {
  const a = (await listAccounts()).find((x) => x.id === id);
  if (!a) throw new Error("Account not found");
  return a;
}

export async function syncFolders(a: Account): Promise<Folder[]> {
  const raw = await invoke<{ name: string; attrs: string[] }[]>("mail_list_folders", { acct: (await connFor(a)).imap });
  const fs = sortFolders(raw.map((f) => ({ name: f.name, role: folderRole(f.name, f.attrs) })));
  await saveFolders(a.id, fs);
  return fs;
}

/** Fetches one page (offset = how many newest to skip). Page 0 also prunes server-deleted messages. */
export async function syncHeaders(a: Account, folder: string, offset = 0): Promise<{ total: number; count: number; msgs: Msg[] }> {
  const page = await invoke<{ total: number; headers: RawHeader[] }>("mail_fetch_headers", { acct: (await connFor(a)).imap, folder, offset, limit: PAGE });
  const ms: Msg[] = page.headers.map(({ messageId: _i, inReplyTo: _r, refs: _f, unsub: _u, ...h }) => ({ ...h, accountId: a.id, folder }));
  if (offset === 0) await dropMessages(a.id, folder, staleUids(await cachedUids(a.id, folder), ms.map((m) => m.uid)));
  await upsertMessages(ms);
  await saveMeta(page.headers.map((h) => ({ ...h, accountId: a.id, folder })));
  return { total: page.total, count: ms.length, msgs: ms };
}

export async function refreshAccounts(args?: Record<string, unknown>) {
  const accounts = (await listAccounts()).filter((a) => !args?.accountId || a.id === args.accountId);
  let n = 0;
  for (const a of accounts) {
    const fs = await syncFolders(a);
    const want = typeof args?.folder === "string" ? args.folder : (folderOfRole(fs, "inbox") ?? "INBOX");
    const got = await syncHeaders(a, want);
    n += got.count;
    if (fs.find((f) => f.name === want)?.role === "inbox") await applyRules(a, got.msgs);
  }
  await logActivity("email", "refresh", `${accounts.length} account(s)`, `${n} header(s)`);
  return { ok: true, count: n };
}

export async function loadMore(args?: Record<string, unknown>) {
  const a = await acctById(String(args?.accountId));
  const folder = String(args?.folder);
  return syncHeaders(a, folder, (await cachedUids(a.id, folder)).length);
}

/** Cached body if present, else fetched. Marks the message read on the server and in the cache. */
export async function openMessage(accountId: string, folder: string, uid: number, seen: boolean): Promise<Body> {
  let body = await cachedBody(accountId, folder, uid);
  const a = await acctById(accountId).catch(() => null);
  if (!body) {
    if (!a) throw new Error("Account not found");
    body = await invoke<Body>("mail_fetch_message", { acct: (await connFor(a)).imap, folder, uid });
    await saveBody(accountId, folder, uid, body);
  }
  if (!seen && a) await setFlag({ accountId, folder, uid, flag: "seen", on: true }).catch(() => {});
  return body;
}

export async function setFlag(args?: Record<string, unknown>) {
  const { accountId, folder, uid, flag, on } = args as { accountId: string; folder: string; uid: number; flag: "seen" | "flagged"; on: boolean };
  await invoke("mail_set_flag", { acct: (await connFor(await acctById(accountId))).imap, folder, uid, flag, on });
  await setCachedFlag(accountId, folder, uid, flag === "seen" ? "seen" : "starred", on);
  return { ok: true };
}

/** Moves to the Trash folder; from Trash itself, deletes permanently. Callers confirm first. */
export async function removeMessage(args?: Record<string, unknown>) {
  const { accountId, folder, uid } = args as { accountId: string; folder: string; uid: number };
  const a = await acctById(accountId), imap = (await connFor(a)).imap;
  const trash = folderOfRole(await cachedFolders(accountId), "trash");
  if (folder === trash) await invoke("mail_delete", { acct: imap, folder, uid });
  else if (trash) await invoke("mail_move", { acct: imap, folder, uid, dest: trash });
  else throw new Error("No Trash folder found on this account — refresh folders first");
  await dropMessages(accountId, folder, [uid]);
  await logActivity("email", folder === trash ? "delete" : "trash", a.email, `uid ${uid}`);
  return { ok: true };
}

export async function sendMail(args?: Record<string, unknown>) {
  const { accountId, to, cc, bcc, subject, body, inReplyTo } = args as { accountId: string; to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; inReplyTo: string };
  const a = await acctById(accountId), c = await connFor(a);
  const sentFolder = savesSentCopy(a.preset) ? null : folderOfRole(await cachedFolders(a.id), "sent");
  const filed = await invoke<boolean>("mail_send", {
    smtp: c.smtp, msg: { from: a.email, to, cc, bcc, subject, body, inReplyTo: inReplyTo || null },
    sent: sentFolder ? [c.imap, sentFolder] : null,
  });
  await logActivity("email", "send_mail", `from ${a.email}`, `${to.length + cc.length + bcc.length} recipient(s)${filed ? ", filed in Sent" : ""}`);
  return { ok: true, filed };
}
