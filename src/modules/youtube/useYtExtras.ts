// Loads YouTube extras (playlists, groups, speed, progress, uploads seen) and wraps their writes.
import { useCallback, useEffect, useMemo, useState } from "react";
import { continueList, groupMap, newUploads } from "./extras";
import * as st from "./extrasStore";
import type { Video } from "./recommend";

export function useYtExtras(videos: Video[]) {
  const [x, setX] = useState<st.YtExtras>({ playlists: [], groups: [], speed: new Map(), progress: [], seen: new Map() });
  const [v, setV] = useState(0);
  const reload = useCallback(() => setV((n) => n + 1), []);
  useEffect(() => { let live = true; st.loadExtras().then((r) => live && setX(r)).catch(() => {}); return () => void (live = false); }, [v, videos.length]);
  const wrap = <A extends unknown[]>(f: (...a: A) => Promise<unknown>) => (...a: A) => void f(...a).then(reload).catch(() => {});
  const groups = useMemo(() => groupMap(x.groups), [x.groups]);
  const uploads = useMemo(() => newUploads(videos, x.seen), [videos, x.seen]);
  return {
    ...x, groups, groupRows: x.groups, uploads, cont: continueList(x.progress),
    resumeAt: (id: string) => x.progress.find((p) => p.videoId === id)?.seconds ?? 0,
    createPlaylist: wrap(st.createPlaylist), deletePlaylist: wrap(st.deletePlaylist),
    addToPlaylist: wrap(st.addToPlaylist), removeFromPlaylist: wrap(st.removeFromPlaylist),
    setGroup: wrap(st.setGroup), setSpeed: wrap(st.setSpeed), dropProgress: wrap(st.dropProgress),
    saveProgress: (p: Parameters<typeof st.saveProgress>[0]) => void st.saveProgress(p).catch(() => {}),
    markSeen: wrap(st.markUploadsSeen),
  };
}
export type YtX = ReturnType<typeof useYtExtras>;
