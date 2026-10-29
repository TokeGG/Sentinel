import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { ScheduleToggle } from "../../core/panel/ScheduleToggle";
import { ErrorLine } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { AccountForm } from "./AccountForm";
import { Compose } from "./Compose";
import { FolderList } from "./FolderList";
import { MessageList } from "./MessageList";
import { Reader } from "./Reader";
import { unreadCount } from "./panelLogic";
import { useMail } from "./useMail";
import { DraftList } from "./DraftList";
import { RulesEditor } from "./RulesEditor";
import { appendDraft } from "./extrasSync";
import { msgKey } from "./threads";
import { VIRTUAL } from "./panelLogic";
import { errorText } from "../../ui/moduleRun";
import "./mail.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const x = useMail(module);
  const [adding, setAdding] = useState(false);
  const [rules, setRules] = useState(false);
  const { account } = x;
  if (!account || adding) {
    return (
      <div className="mail-root mail-setup">
        {x.error && <ErrorLine message={x.error} />}
        <AccountForm busy={x.busy} onCancel={account ? () => setAdding(false) : undefined}
          onAdd={async (d) => {
            const r = (await x.run("add_account", { ...d })) as { id: string } | undefined;
            if (r) { setAdding(false); x.setAccountId(r.id); await x.run("refresh", { accountId: r.id }); }
          }} />
      </div>
    );
  }
  const sel = x.selected, selAcct = x.msgAccount(sel);
  const toServer = async () => {
    if (!x.draft) return;
    try { x.setLocal((await appendDraft(account, x.draft)) ? "Draft saved to the server Drafts folder." : "No Drafts folder on this account; kept locally."); } catch (e) { x.setLocal(errorText(e)); }
  };
  const trash = x.folders.find((f) => f.name === x.folder)?.role === "trash";
  return (
    <div className="mail-root">
      <h2 className="ui-head mail-bar"><span className="ui-dot" />{module.name}<span className="mail-acct">{account.email}</span>
        <button type="button" className="ui-btn mail-refresh" disabled={x.busy} onClick={() => void x.run("refresh", x.folder.startsWith("__") ? {} : { accountId: account.id, folder: x.folder })}>{x.busy ? "Working…" : "Refresh"}</button>
        <ScheduleToggle module={module} />
      </h2>
      {x.error && <ErrorLine message={x.error} />}
      <Sections className="mail-app">
        <Section id="folders">
          <FolderList accounts={x.accounts} account={account} onAccount={x.setAccountId} folders={x.folders} folder={x.folder} onFolder={x.openFolder}
            onAdd={() => setAdding(true)} onRemove={(a) => void x.run("remove_account", { id: a.id })} onCompose={() => x.compose("new")} onRules={() => setRules(!rules)} busy={x.busy} unread={unreadCount(x.shown)} />
        </Section>
        <Section id="list">
          {rules && <RulesEditor rules={x.ex.rules} folders={x.folders} onChange={x.ex.reload} onClose={() => setRules(false)} />}
          {x.folder === VIRTUAL.drafts ? <DraftList drafts={x.ex.drafts} onOpen={x.resume} onDelete={(id) => void x.ex.dropDraft(id)} /> :
          <MessageList msgs={x.shown} selKey={x.selKey} counts={x.counts} threaded={x.threaded} onThreaded={x.setThreaded} query={x.query} onQuery={x.setQuery} onPick={(m) => void x.pick(m)} busy={x.busy}
            onStar={(m) => void x.flag(m, "flagged", !m.starred)} onMore={() => !x.folder.startsWith("__") && void x.run("load_more", { accountId: account.id, folder: x.folder })} />}
        </Section>
        <Section id="reader">
          <Reader msg={x.selected} body={x.body} busy={x.busy} inTrash={trash} onCompose={x.compose}
            onFlag={(f, on) => x.selected && void x.flag(x.selected, f, on)} onDelete={() => x.selected && void x.remove(x.selected)}
            x={{ account: selAcct, thread: x.thread, selKey: x.selKey, onPick: (m) => void x.pick(m), snoozed: sel ? x.ex.snooze.get(msgKey(sel)) : undefined,
              onSnooze: (u) => sel && void x.ex.snoozeMsg(sel, u).then(x.reload), unsub: sel ? x.ex.meta.get(msgKey(sel))?.unsub ?? "" : "",
              onMail: (to, subject, body) => selAcct && void x.run("send_mail", { accountId: selAcct.id, to: [to], cc: [], bcc: [], subject, body, inReplyTo: "" }) }} />
        </Section>
        <Section id="compose">
          {x.draft && <Compose from={account.email} draft={x.draft} busy={x.busy} pool={x.ex.pool} onChange={x.setDraft} onSend={() => void x.send()}
            onClose={x.close} onDiscard={() => void x.discard()} onServer={() => void toServer()} />}
        </Section>
      </Sections>
    </div>
  );
}
