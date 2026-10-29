// Network side of the mail extras. Every call is a user action, or part of the
// refresh the user started (rules); nothing here runs on its own.
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { logActivity } from "../../core/db";
import { connFor } from "./accounts";
import { cachedFolders, dropMessages, setCachedFlag } from "./cache";
import { listRules } from "./extrasStore";
import { folderOfRole } from "./folders";
import { planRules } from "./rules";
import type { Account, Msg } from "./types";

/** Runs the user's rules over freshly fetched inbox messages. Returns how many steps ran. */
export async function applyRules(a: Account, ms: Msg[]): Promise<number> {
  const steps = planRules(ms, await listRules());
  if (!steps.length) return 0;
  const imap = (await connFor(a)).imap;
  let n = 0;
  for (const { msg, rule } of steps) {
    try {
      if (rule.action === "move") {
        await invoke("mail_move", { acct: imap, folder: msg.folder, uid: msg.uid, dest: rule.arg });
        await dropMessages(a.id, msg.folder, [msg.uid]);
      } else {
        const flag = rule.action === "flag" ? "flagged" : "seen";
        await invoke("mail_set_flag", { acct: imap, folder: msg.folder, uid: msg.uid, flag, on: true });
        await setCachedFlag(a.id, msg.folder, msg.uid, flag === "seen" ? "seen" : "starred", true);
      }
      n++;
    } catch { /* one failing step (e.g. missing folder) must not stop the rest */ }
  }
  await logActivity("email", "rules", a.email, `${n}/${steps.length} step(s)`);
  return n;
}

export interface AttachData { name: string; mime: string; data: string }
export async function fetchAttachment(a: Account, m: Msg, index: number): Promise<AttachData> {
  return invoke<AttachData>("mail_fetch_attachment", { acct: (await connFor(a)).imap, folder: m.folder, uid: m.uid, index });
}
/** Asks where to save (dialog), then Rust writes exactly that one attachment there. */
export async function saveAttachment(a: Account, m: Msg, index: number, name: string): Promise<boolean> {
  const path = await save({ defaultPath: name.replace(/[\\/:*?"<>|]/g, "_") });
  if (!path) return false;
  await invoke("mail_save_attachment", { acct: (await connFor(a)).imap, folder: m.folder, uid: m.uid, index, path });
  await logActivity("email", "save_attachment", a.email, name);
  return true;
}

/** IMAP APPEND of a draft to the account's Drafts folder (if it has one). */
export async function appendDraft(a: Account, d: { to: string; cc: string; subject: string; body: string }): Promise<boolean> {
  const folder = folderOfRole(await cachedFolders(a.id), "drafts");
  if (!folder) return false;
  await invoke("mail_append_draft", { acct: (await connFor(a)).imap, folder, msg: { from: a.email, to: d.to, cc: d.cc, subject: d.subject, body: d.body } });
  return true;
}
