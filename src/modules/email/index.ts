import { invoke } from "@tauri-apps/api/core";
import { getDb, logActivity } from "../../core/db";
import { getCredential } from "../../core/credentials";
import { registerModule, type ModuleManifest } from "../../core/module";

const MODULE_ID = "hub.email";

interface MailHeader {
  uid: number;
  from: string;
  subject: string;
  date: string;
}

interface InboxRow extends Record<string, unknown> {
  id: number;
  uid: number;
  sender: string;
  subject: string;
  mail_date: string | null;
}

async function requiredCreds(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = await getCredential(MODULE_ID, k);
    if (!v) throw new Error(`missing "${k}" — fill in the Credentials section above first`);
    out[k] = v;
  }
  return out;
}

async function fetchInbox() {
  const creds = await requiredCreds(["imap_host", "imap_port", "username", "password"]);
  const headers = await invoke<MailHeader[]>("imap_fetch_inbox", {
    host: creds.imap_host,
    port: Number(creds.imap_port),
    username: creds.username,
    password: creds.password,
    limit: 50,
  });

  const d = await getDb();
  for (const h of headers) {
    await d.execute(
      `INSERT INTO email_inbox (uid, sender, subject, mail_date) VALUES ($1, $2, $3, $4)
       ON CONFLICT(uid) DO UPDATE SET sender = $2, subject = $3, mail_date = $4`,
      [h.uid, h.from, h.subject, h.date]
    );
  }
  await logActivity("email", "fetch_inbox", "IMAP read-only fetch", `${headers.length} message(s)`);
  return { ok: true, count: headers.length };
}

async function sendMail(args?: Record<string, unknown>) {
  const creds = await requiredCreds(["smtp_host", "smtp_port", "username", "password"]);
  const to = String(args?.to ?? "");
  const subject = String(args?.subject ?? "");
  const body = String(args?.body ?? "");
  if (!to || !subject) throw new Error("to and subject are required");

  await invoke("smtp_send_mail", {
    host: creds.smtp_host,
    port: Number(creds.smtp_port),
    username: creds.username,
    password: creds.password,
    to,
    subject,
    body,
  });
  await logActivity("email", "send_mail", `to ${to}`, "sent");
  return { ok: true };
}

async function loadRows(): Promise<Record<string, unknown>[]> {
  const d = await getDb();
  const rows = await d.select<InboxRow[]>(
    "SELECT * FROM email_inbox ORDER BY uid DESC LIMIT 100"
  );
  return rows.map((r) => ({
    id: r.id,
    title: `${r.subject} — ${r.sender}`,
    label: r.mail_date ?? undefined,
  }));
}

export const emailModule: ModuleManifest = {
  id: MODULE_ID,
  name: "Email",
  description:
    "Generic IMAP/SMTP. Read-only fetch and send are distinct actions — nothing sends automatically.",
  panel: "list",
  skills: [
    { name: "fetch_inbox", run: fetchInbox },
    { name: "send_mail", run: sendMail },
  ],
  load: loadRows,
  actions: [{ label: "Fetch inbox", skill: "fetch_inbox" }],
  forms: [
    {
      skill: "send_mail",
      label: "Compose",
      fields: [
        { key: "to", label: "To" },
        { key: "subject", label: "Subject" },
        { key: "body", label: "Body", type: "textarea" },
      ],
    },
  ],
  credentialFields: [
    { key: "imap_host", label: "IMAP host" },
    { key: "imap_port", label: "IMAP port (e.g. 993)" },
    { key: "smtp_host", label: "SMTP host" },
    { key: "smtp_port", label: "SMTP port (e.g. 587)" },
    { key: "username", label: "Username / email" },
    { key: "password", label: "Password" },
  ],
};

registerModule(emailModule);
