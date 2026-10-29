import { useState } from "react";
import { folderLabel } from "./folders";
import type { Account, Folder } from "./types";

export function FolderList({ accounts, account, onAccount, folders, folder, onFolder, onAdd, onRemove, onCompose, busy }: {
  accounts: Account[]; account: Account | undefined; onAccount: (id: string) => void;
  folders: Folder[]; folder: string; onFolder: (n: string) => void;
  onAdd: () => void; onRemove: (a: Account) => void; onCompose: () => void; busy: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const list = folders.length ? folders : [{ name: "INBOX", role: "inbox" as const }];
  return (
    <nav className="mail-folders">
      <button type="button" className="ui-btn primary" onClick={onCompose} disabled={!account}>Compose</button>
      <select value={account?.id ?? ""} onChange={(e) => { setConfirm(false); onAccount(e.target.value); }}>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <ul>
        {list.map((f) => (
          <li key={f.name}><button type="button" className={f.name === folder ? "active" : ""} disabled={busy} onClick={() => onFolder(f.name)}>{folderLabel(f)}</button></li>
        ))}
      </ul>
      <div className="mail-row">
        <button type="button" className="ui-btn" onClick={onAdd}>Add account</button>
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
