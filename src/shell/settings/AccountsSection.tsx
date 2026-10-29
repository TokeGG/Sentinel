import { useCallback, useEffect, useState } from "react";
import { ConnectButton } from "../../core/connect/ConnectButton";
import { ClientIdStep } from "../../core/connect/ClientIdStep";
import { connectLabel, firstError, statusText } from "../../core/connect/accountsLogic";
import { clientGroups, PROVIDERS } from "../../core/connect/providers";
import { disconnect, listAccounts, onAccountsChanged, type AccountRow } from "../../core/connect";
import { getOverrides } from "../../core/connect/clientStore";
import { Row } from "../../ui/kit";
import { Head } from "./Switch";

function Disconnect({ row, onError }: { row: AccountRow; onError(e: unknown): void }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="ui-btn" onClick={() => setAsk(true)}>Disconnect {row.label || row.account}</button>;
  return (
    <span className="st-confirm">
      Remove saved sign-in for {row.label || row.account}?{" "}
      <button type="button" className="ui-btn" onClick={() => disconnect(row.provider, row.account).catch(onError)}>Yes, disconnect</button>{" "}
      <button type="button" className="ui-btn" onClick={() => setAsk(false)}>Cancel</button>
    </span>
  );
}

export function AccountsSection({ onError }: { onError(e: unknown): void }) {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [ids, setIds] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    listAccounts().then(setRows).catch(onError);
    getOverrides().then(setIds).catch(onError);
  }, [onError]);
  useEffect(() => { load(); return onAccountsChanged(load); }, [load]);
  return (
    <section className="st-section" aria-label="Accounts">
      <Head>Accounts</Head>
      <p className="ui-meta">Sign in once in your browser; Sentinel keeps the sign-in in the Windows keychain and refreshes it silently. Passwords are never seen or stored.</p>
      {PROVIDERS.map((p) => {
        const mine = rows.filter((r) => r.provider === p.id);
        const err = firstError(mine);
        return (
          <div key={p.id} className="st-acct">
            <Row end={<span className="ui-meta">{statusText(mine)}</span>}><strong>{p.label}</strong> <span className="ui-meta">{p.purpose}</span></Row>
            {err && <div className="ui-meta st-acct-err">Last refresh error: {err}</div>}
            {mine.map((r) => <Disconnect key={r.account} row={r} onError={onError} />)}
            <ConnectButton providerId={p.id} label={connectLabel(p, mine)} className="ui-btn" />
          </div>
        );
      })}
      <details className="st-acct">
        <summary>Client IDs</summary>
        <p className="ui-meta">Public IDs from your own free app registrations (see docs/ACCOUNTS.md). Not secret; stored in settings. Leave blank to use the one this build ships with.</p>
        {clientGroups().map((g) => (
          <div key={g.group}>
            <Row end={<span className="ui-meta">{ids[g.group] ? "set" : "not set"}</span>}>{g.providers.map((p) => p.label).join(", ")}</Row>
            <ClientIdStep group={g.group} wantsSecret={g.secret} onSaved={load} onError={onError} />
          </div>
        ))}
      </details>
      <p className="ui-meta">Bluesky has no public-client OAuth that works here, so it keeps its app-password sign-in in the Social panel.</p>
    </section>
  );
}
