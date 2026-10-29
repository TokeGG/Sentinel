import { registerModule, type ModuleManifest } from "../../core/module";
import { addAccount, listAccounts, removeAccount } from "./accounts";
import { unreadInbox } from "./cache";
import { emailSections } from "./panelLogic";
import type { AccountDraft } from "./presets";
import { loadMore, refreshAccounts, removeMessage, sendMail, setFlag } from "./sync";

const MODULE_ID = "hub.email";

// Rows = the configured accounts (no secrets); the panel reads messages from the cache itself.
async function loadRows(): Promise<Record<string, unknown>[]> {
  return (await listAccounts()).map((a) => ({ ...a, title: a.email }));
}

export const emailModule: ModuleManifest = {
  id: MODULE_ID,
  name: "Email",
  accent: "#06d8d9",
  ring: "daily",
  category: "mail",
  icon: "email",
  description: "IMAP/SMTP mail client. Passwords live only in the OS keychain. Nothing is fetched or sent unless you press a button (auto-refresh is opt-in).",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: emailSections },
  skills: [
    { name: "refresh", run: refreshAccounts },
    { name: "load_more", run: loadMore },
    { name: "set_flag", run: setFlag },
    { name: "remove_message", run: removeMessage },
    { name: "send_mail", run: sendMail },
    { name: "add_account", run: async (a) => ({ id: await addAccount(a as unknown as AccountDraft) }) },
    { name: "remove_account", run: async (a) => void (await removeAccount(String(a?.id))) },
  ],
  load: loadRows,
  schedule: { skill: "refresh", intervalMinutes: 10 },
  badge: unreadInbox,
};

registerModule(emailModule);
