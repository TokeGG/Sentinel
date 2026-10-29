// "Test" for one provider: checks the client ID format and endpoint config (no sign-in, no network).
import { useState } from "react";
import { clientIdFor } from "./clientStore.ts";
import { checkProvider, type Check } from "./diagnose.ts";
import { getProvider } from "./providers.ts";

export function TestButton({ providerId }: { providerId: string }) {
  const [res, setRes] = useState<Check[] | null>(null);
  const run = async () => {
    const p = getProvider(providerId);
    const id = p.clientGroup ? await clientIdFor(p.clientGroup).catch(() => "") : "";
    setRes(checkProvider(p, id));
  };
  return (
    <span className="st-test">
      <button type="button" className="ui-btn" onClick={() => void run()}>Test</button>
      {res && (
        <ul className="ui-meta">
          {res.map((c) => <li key={c.line}>{c.ok ? "OK" : "PROBLEM"}: {c.line}</li>)}
          <li>{res.every((c) => c.ok) ? "Config looks right; Connect should open your browser." : "Fix the problems above, then press Connect."}</li>
        </ul>
      )}
    </span>
  );
}
