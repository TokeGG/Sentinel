// Lists, mutes and the inbox mode for the Social feed (kept out of Panel.tsx).
import { useCallback, useEffect, useMemo, useState } from "react";
import { errorText } from "../../ui/moduleRun";
import { fetchInbox, loadListsMutes, setListMember, setMute, type ListRow } from "./listsStore";
import { applyMutes, inList, toLists, toMutes } from "./muteLists";
import type { FeedPost } from "./panelLogic";

export function useFeedFilters() {
  const [lists, setLists] = useState<ListRow[]>([]);
  const [muteRows, setMuteRows] = useState<{ kind: string; value: string }[]>([]);
  const [list, setList] = useState<string | null>(null);
  const [inbox, setInbox] = useState<FeedPost[] | null>(null);
  const [inboxBusy, setInboxBusy] = useState(false);
  const [inboxErr, setInboxErr] = useState<string | null>(null);
  const [v, setV] = useState(0);
  const bump = useCallback(() => setV((n) => n + 1), []);
  useEffect(() => { let live = true; loadListsMutes().then((r) => { if (live) { setLists(r.lists); setMuteRows(r.mutes); } }).catch(() => {}); return () => void (live = false); }, [v]);
  const listMap = useMemo(() => toLists(lists), [lists]);
  const mutes = useMemo(() => toMutes(muteRows), [muteRows]);
  const apply = useCallback((ps: FeedPost[]) => inList(applyMutes(ps, mutes), list ? listMap.get(list) : undefined), [mutes, list, listMap]);
  const loadInbox = async () => {
    setInboxBusy(true); setInboxErr(null);
    try { const r = await fetchInbox(); setInbox(r.posts); if (r.errors.length) setInboxErr(r.errors.join("; ")); } catch (e) { setInboxErr(errorText(e)); }
    setInboxBusy(false);
  };
  return {
    lists, listNames: [...listMap.keys()], muteRows, list, setList, apply, inbox, inboxBusy, inboxErr, loadInbox, closeInbox: () => setInbox(null),
    member: (name: string, platform: string, handle: string, on: boolean) => void setListMember(name, platform, handle, on).then(bump),
    mute: (kind: "word" | "account", value: string, on: boolean) => void setMute(kind, value, on).then(bump),
  };
}
export type FeedFilters = ReturnType<typeof useFeedFilters>;
