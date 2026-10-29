// Values for a server's declared secret env names; stored in the OS keychain, never shown again.
import { useEffect, useState } from "react";
import { hasSecret } from "./mcp";
import type { Item } from "./panelLogic";
import type { ModuleState } from "../../ui/useModule";

export function SecretFields({ item, busy, run }: { item: Item; busy: boolean; run: ModuleState["run"] }) {
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    Promise.all(item.secrets.map(async (n) => [n, await hasSecret(item.key, n)] as const)).then((e) => setSaved(Object.fromEntries(e)));
  }, [item.key, item.secrets, busy]);
  if (!item.secrets.length) return null;
  return (
    <div className="sk-secrets">
      {item.secrets.map((n) => (
        <form key={n} className="ui-quickadd" onSubmit={async (e) => {
          e.preventDefault();
          if ((await run("save_secret", { key: item.key, name: n, value: draft[n] })) !== undefined) setDraft({ ...draft, [n]: "" });
        }}>
          <input type="password" autoComplete="off" value={draft[n] ?? ""} onChange={(e) => setDraft({ ...draft, [n]: e.target.value })}
            placeholder={`${n} ${saved[n] ? "(saved - replace)" : "(not set)"}`} aria-label={n} />
          <button type="submit" className="ui-btn" disabled={busy || !draft[n]}>Save</button>
        </form>
      ))}
    </div>
  );
}
