// Provider presets and account validation. Pure. No OAuth: Gmail/iCloud need an app password.
import type { Account, Tls } from "./types.ts";
import { isEmail } from "./addresses.ts";

export interface Preset {
  id: string; label: string; imapHost: string; imapPort: number; imapTls: Tls;
  smtpHost: string; smtpPort: number; smtpTls: Tls;
  note: string;
  /** The provider files its own Sent copy, so we must not append one (duplicate). */
  savesSent: boolean;
}

export const PRESETS: Preset[] = [
  { id: "gmail", label: "Gmail", imapHost: "imap.gmail.com", imapPort: 993, imapTls: "ssl", smtpHost: "smtp.gmail.com", smtpPort: 465, smtpTls: "ssl", savesSent: true,
    note: "Gmail needs an app password (Google Account > Security > 2-Step Verification > App passwords) and IMAP enabled. Your normal password will not work." },
  { id: "icloud", label: "iCloud", imapHost: "imap.mail.me.com", imapPort: 993, imapTls: "ssl", smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpTls: "starttls", savesSent: false,
    note: "iCloud needs an app-specific password (appleid.apple.com > Sign-In and Security). The username is your full iCloud address." },
  { id: "outlook", label: "Outlook / Hotmail", imapHost: "outlook.office365.com", imapPort: 993, imapTls: "ssl", smtpHost: "smtp.office365.com", smtpPort: 587, smtpTls: "starttls", savesSent: true,
    note: "Outlook.com may require an app password (with two-step verification) and some work/school tenants disable basic IMAP sign-in." },
  { id: "yahoo", label: "Yahoo", imapHost: "imap.mail.yahoo.com", imapPort: 993, imapTls: "ssl", smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpTls: "ssl", savesSent: false,
    note: "Yahoo needs an app password (Account Security > Generate app password)." },
  { id: "custom", label: "Other (manual)", imapHost: "", imapPort: 993, imapTls: "ssl", smtpHost: "", smtpPort: 587, smtpTls: "starttls", savesSent: false,
    note: "Enter your provider's IMAP and SMTP details. Use an app password if the provider offers one." },
];

export const presetById = (id: string): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
export const savesSentCopy = (presetId: string) => presetById(presetId).savesSent;

export type AccountDraft = Omit<Account, "id"> & { password: string };

export function draftFromPreset(id: string, email = ""): AccountDraft {
  const p = presetById(id);
  return { label: email || p.label, email, username: email, preset: p.id, imapHost: p.imapHost, imapPort: p.imapPort, imapTls: p.imapTls,
    smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpTls: p.smtpTls, password: "" };
}

const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;
const port = (n: number) => Number.isInteger(n) && n > 0 && n < 65536;
/** Error list for the add-account form; empty means valid. */
export function validateDraft(d: AccountDraft): string[] {
  const e: string[] = [];
  if (!isEmail(d.email)) e.push("Enter a valid email address");
  if (!d.username.trim()) e.push("Username is required");
  if (!d.password) e.push("Password / app password is required");
  if (!HOST.test(d.imapHost.trim())) e.push("IMAP host is invalid");
  if (!HOST.test(d.smtpHost.trim())) e.push("SMTP host is invalid");
  if (!port(d.imapPort) || !port(d.smtpPort)) e.push("Ports must be 1-65535");
  return e;
}
