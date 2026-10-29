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
import "./mail.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const x = useMail(module);
  const [adding, setAdding] = useState(false);
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
  const trash = x.folders.find((f) => f.name === x.folder)?.role === "trash";
  return (
    <div className="mail-root">
      <h2 className="ui-head mail-bar"><span className="ui-dot" />{module.name}<span className="mail-acct">{account.email}</span>
        <button type="button" className="ui-btn mail-refresh" disabled={x.busy} onClick={() => void x.run("refresh", { accountId: account.id, folder: x.folder })}>{x.busy ? "Working…" : "Refresh"}</button>
        <ScheduleToggle module={module} />
      </h2>
      {x.error && <ErrorLine message={x.error} />}
      <Sections className="mail-app">
        <Section id="folders">
          <FolderList accounts={x.accounts} account={account} onAccount={x.setAccountId} folders={x.folders} folder={x.folder} onFolder={x.openFolder}
            onAdd={() => setAdding(true)} onRemove={(a) => void x.run("remove_account", { id: a.id })} onCompose={() => x.compose("new")} busy={x.busy} unread={unreadCount(x.shown)} />
        </Section>
        <Section id="list">
          <MessageList msgs={x.shown} uid={x.selected?.uid ?? null} query={x.query} onQuery={x.setQuery} onPick={(m) => void x.pick(m)} busy={x.busy}
            onStar={(m) => void x.flag(m, "flagged", !m.starred)} onMore={() => void x.run("load_more", { accountId: account.id, folder: x.folder })} />
        </Section>
        <Section id="reader">
          <Reader msg={x.selected} body={x.body} busy={x.busy} inTrash={trash} onCompose={x.compose}
            onFlag={(f, on) => x.selected && void x.flag(x.selected, f, on)} onDelete={() => x.selected && void x.remove(x.selected)} />
        </Section>
        <Section id="compose">
          {x.draft && <Compose from={account.email} draft={x.draft} busy={x.busy} onChange={x.setDraft} onSend={() => void x.send()} onClose={() => x.setDraft(null)} />}
        </Section>
      </Sections>
    </div>
  );
}
