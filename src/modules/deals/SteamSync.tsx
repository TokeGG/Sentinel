// Steam wishlist sync: fetch on button press, preview names, then add them as wishes (matched against deals).
import { useEffect, useState } from "react";
import type { ModuleState } from "../../ui/useModule";
import { savedSteamProfile } from "./wishSync";

export function SteamSync({ run, busy }: { run: ModuleState["run"]; busy: boolean }) {
  const [profile, setProfile] = useState("");
  const [found, setFound] = useState<string[] | null>(null);
  useEffect(() => { void savedSteamProfile().then(setProfile); }, []);
  const fetchList = async () => {
    const r = (await run("steam_wishlist", { profile })) as { names?: string[] } | undefined;
    setFound(r?.names ?? null);
  };
  return (
    <div className="dl-steam">
      <div className="ui-controls">
        <input className="ui-file-text" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="Steam profile id or custom URL name" aria-label="Steam profile" />
        <button type="button" className="ui-btn ui-sm" disabled={busy || !profile.trim()} onClick={() => void fetchList()}>{busy ? "Fetching…" : "Fetch Steam wishlist"}</button>
      </div>
      {found && (
        <div>
          <p className="ui-meta">{found.length ? `${found.length} new game(s): ${found.slice(0, 20).join(", ")}${found.length > 20 ? "…" : ""}` : "Nothing new on that wishlist."}</p>
          {found.length > 0 && <button type="button" className="ui-btn ui-sm primary" disabled={busy} onClick={() => void run("add_wishes", { names: found }).then(() => setFound(null))}>Add {found.length} as wishes</button>}
        </div>
      )}
      <p className="ui-meta">Public Steam wishlists only, fetched only when you press the button. Epic has no public wishlist API.</p>
    </div>
  );
}
