// Account storage. Non-secret settings -> SQLite `mail_accounts`; the password /
// app password -> OS keychain only, under service hub.email, key `pw:<accountId>`.
import { getDb } from "../../core/db";
import { deleteCredential, getCredential, setCredential } from "../../core/credentials";
import type { Account, Tls } from "./types.ts";
import type { AccountDraft } from "./presets.ts";
import { authOf } from "./mailAuth.ts";
import { getAccessToken } from "../../core/connect";

export const MODULE_ID = "hub.email";
const pwKey = (id: string) => `pw:${id}`;

interface Row { id: string; label: string; email: string; username: string; preset: string; imap_host: string; imap_port: number; imap_tls: string; smtp_host: string; smtp_port: number; smtp_tls: string }
const toAccount = (r: Row): Account => ({ id: r.id, label: r.label, email: r.email, username: r.username, preset: r.preset, imapHost: r.imap_host, imapPort: r.imap_port, imapTls: r.imap_tls as Tls, smtpHost: r.smtp_host, smtpPort: r.smtp_port, smtpTls: r.smtp_tls as Tls });

export async function listAccounts(): Promise<Account[]> {
  const d = await getDb();
  return (await d.select<Row[]>("SELECT * FROM mail_accounts ORDER BY position, label")).map(toAccount);
}

export async function addAccount(x: AccountDraft): Promise<string> {
  const id = crypto.randomUUID();
  const d = await getDb();
  // first: no row without a stored secret (OAuth accounts keep theirs in core/connect)
  if (!authOf(x.preset).provider) await setCredential(MODULE_ID, pwKey(id), x.password);
  await d.execute(
    `INSERT INTO mail_accounts (id,label,email,username,preset,imap_host,imap_port,imap_tls,smtp_host,smtp_port,smtp_tls,position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,(SELECT COUNT(*) FROM mail_accounts))`,
    [id, x.label.trim() || x.email, x.email.trim(), x.username.trim(), x.preset, x.imapHost.trim(), x.imapPort, x.imapTls, x.smtpHost.trim(), x.smtpPort, x.smtpTls]
  );
  return id;
}

export async function removeAccount(id: string): Promise<void> {
  const d = await getDb();
  for (const t of ["mail_bodies", "mail_messages", "mail_folders"]) await d.execute(`DELETE FROM ${t} WHERE account_id = $1`, [id]);
  await d.execute("DELETE FROM mail_accounts WHERE id = $1", [id]);
  await deleteCredential(MODULE_ID, pwKey(id)).catch(() => {});
}

type Side = { host: string; port: number; tls: Tls; username: string; password: string; auth: "password" | "xoauth2" };
export interface Conn { imap: Side; smtp: Side }
/** Per-call connection args. The password / fresh OAuth token is read here and goes nowhere else (Rust never stores it). */
export async function connFor(a: Account): Promise<Conn> {
  const { provider } = authOf(a.preset);
  const password = provider ? await getAccessToken(provider, a.email) : await getCredential(MODULE_ID, pwKey(a.id));
  if (!password) throw new Error(`No saved password for ${a.email} — remove and re-add the account`);
  const auth = provider ? "xoauth2" : "password";
  return {
    imap: { host: a.imapHost, port: a.imapPort, tls: a.imapTls, username: a.username, password, auth },
    smtp: { host: a.smtpHost, port: a.smtpPort, tls: a.smtpTls, username: a.username, password, auth },
  };
}
