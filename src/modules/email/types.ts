// Shared shapes for the mail module (account config has NO password: that lives in the keychain).
export type Tls = "ssl" | "starttls";
export interface Account {
  id: string; label: string; email: string; username: string; preset: string;
  imapHost: string; imapPort: number; imapTls: Tls;
  smtpHost: string; smtpPort: number; smtpTls: Tls;
}
export type Role = "inbox" | "sent" | "drafts" | "trash" | "junk" | "archive" | "other";
export interface Folder { name: string; role: Role }
export interface Msg {
  accountId: string; folder: string; uid: number;
  fromName: string; fromAddr: string; to: string; subject: string; preview: string;
  dateTs: number; seen: boolean; starred: boolean; answered: boolean; hasAttach: boolean;
}
export interface Addr { name: string; address: string }
export interface Body {
  text: string | null; html: string | null;
  from: Addr[]; to: Addr[]; cc: Addr[]; replyTo: Addr[];
  messageId: string; attachments: { name: string; mime: string; size: number }[];
}
