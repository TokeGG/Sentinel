import { useState } from "react";
import { folderLabel } from "./folders";
import { VIRTUAL, virtualLabel } from "./panelLogic";
import type { Account, Folder } from "./types";

export function FolderList({ accounts, account, onAccount, folders, folder, onFolder, onAdd, onRemove, onCompose, onRules, busy, unread }: {
  accounts: Account[]; account: Account | undefined; onAccount: (id: string) => void;
  folders: Folder[]; folder: string; onFolder: (n: string) => void;
  onAdd: () => void; onRemove: (a: Account) => void; onCompose: () => void; onRules: () => void; busy: boolean; unread?: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const list = folders.length ? folders : [{ name: "INBOX", role: "inbox" as const }];
  return (
    <nav className="mail-folders">
      <button type="button" className="ui-btn primary mail-compose-btn" onClick={onCompose} disabled={!account}>+ Compose</button>
      <select value={account?.id ?? ""} onChange={(e) => { setConfirm(false); onAccount(e.target.value); }}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <ul className="mail-virtual">
        {Object.values(VIRTUAL).map((v) => <li key={v}><button type="button" className={v === folder ? "active" : ""} onClick={() => onFolder(v)}><span>{virtualLabel[v]}</span></button></li>)}
      </ul>
      <ul>
        {list.map((f) => (
          <li key={f.name} data-role={f.role}><button type="button" className={f.name === folder ? "active" : ""} disabled={busy} onClick={() => onFolder(f.name)}><span>{folderLabel(f)}</span>{f.name === folder && !!unread && <em className="mail-count">{unread}</em>}</button></li>
        ))}
      </ul>
      <div className="mail-row">
        <button type="button" className="ui-btn" onClick={onAdd}>Add account</button>
        <button type="button" className="ui-btn" onClick={onRules}>Rules</button>
        {account && !confirm && <button type="button" className="ui-btn" onClick={() => setConfirm(true)}>Remove</button>}
      </div>
      {account && confirm && (
        <div className="mail-confirm">
          Remove {account.email}? Its saved password and cached mail are deleted from this PC (mail on the server is untouched).
          <button type="button" className="ui-btn" onClick={() => { setConfirm(false); onRemove(account); }}>Yes, remove</button>
          <button type="button" className="ui-btn" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      )}
    </nav>
  );
}
