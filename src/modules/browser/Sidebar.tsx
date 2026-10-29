// Opera-like left sidebar: pinned web apps (user-editable in Settings), each opens in a tab.
import { useEffect, useState } from "react";
import { listApps, type WebApp } from "./store";

export const APPS_CHANGED = "browser-apps-changed"; // window event after Settings edits
export function Sidebar({ open, onError }: { open(url: string): void; onError(e: unknown): void }) {
  const [apps, setApps] = useState<WebApp[]>([]);
  useEffect(() => {
    const load = () => listApps().then(setApps).catch(onError);
    load();
    window.addEventListener(APPS_CHANGED, load);
    return () => window.removeEventListener(APPS_CHANGED, load);
  }, []);
  return (
    <nav className="br-side" aria-label="Web apps">
      {apps.map((a) => (
        <button key={a.id} title={a.name} aria-label={a.name} onClick={() => open(a.url)}>{a.name.slice(0, 2)}</button>
      ))}
    </nav>
  );
}
