import { useCallback, useEffect, useState } from "react";
import { defaultTabs, tabsReducer, type EmbedSite, type TabAction } from "./embedSites";
import { loadTabs, saveTabs } from "./tabsStore";

/** Editable site tabs: loaded once, every valid change saved. */
export function useSiteTabs() {
  const [sites, setSites] = useState<EmbedSite[]>(defaultTabs);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadTabs().then(setSites).catch((e) => setError(String(e))); }, []);
  const dispatch = useCallback((a: TabAction) => {
    setSites((cur) => {
      const next = tabsReducer(cur, a);
      if (next !== cur) saveTabs(next).catch((e) => setError(String(e)));
      return next;
    });
  }, []);
  return { sites, dispatch, error };
}
