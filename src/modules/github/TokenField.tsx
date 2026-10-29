// The GitHub PAT field: the existing CredentialFields (OS keychain only). When
// a token is already saved the field collapses; the token is read only to learn
// that it exists (Boolean) and is never kept, shown or logged. Until that check
// resolves the field renders collapsed with a neutral label (no flash).
import { useCallback, useEffect, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { CredentialFields } from "../../core/panel/CredentialFields";
import { getCredential } from "../../core/credentials";
import { ConnectButton } from "../../core/connect/ConnectButton";

export function TokenField({ module, recheck }: { module: ModuleManifest; recheck: unknown }) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const key = module.credentialFields?.[0]?.key;
  useEffect(() => {
    if (!key) return;
    let live = true;
    getCredential(module.id, key)
      .then((t) => live && setSaved(Boolean(t)))
      .catch(() => live && setSaved(null)); // unknown: stay collapsed but reachable
    return () => void (live = false);
  }, [module.id, key, recheck, tick]);
  const onSaved = useCallback(() => setTick((n) => n + 1), []);
  const label = saved === true ? "GitHub token saved — replace…" : saved === false ? "GitHub token (optional — needed for My Starred)" : "GitHub token";
  return (
    <details className="ui-token" key={String(saved)} open={saved === false}>
      <summary>{label}</summary>
      <ConnectButton providerId="github" label="Sign in with GitHub (device code)" onConnected={onSaved} />
      <p className="ui-meta">Or paste a personal access token:</p>
      <CredentialFields module={module} onSaved={onSaved} />
    </details>
  );
}
