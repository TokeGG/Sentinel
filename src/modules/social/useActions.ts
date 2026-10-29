// Optimistic per-post actions: apply locally, call the platform, roll back and
// report on failure. Overrides are dropped whenever the rows reload.
import { useEffect, useMemo, useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { findSkill } from "../../ui/moduleRun";
import { applyAction, postKey, withReply, type ActionKind } from "./actionLogic";
import type { FeedPost } from "./panelLogic";
import { saveAction } from "./store";

export function useActions(module: ModuleManifest, posts: FeedPost[]) {
  const [over, setOver] = useState<Record<string, FeedPost>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setOver({}), [posts]);

  const view = useMemo(() => posts.map((p) => over[postKey(p)] ?? p), [posts, over]);

  const call = (p: FeedPost, kind: string, text?: string) =>
    findSkill(module, "post_action").run({ platform: p.platform, kind, postId: p.postId, meta: p.meta, text }) as Promise<FeedPost["meta"]>;

  // Shared flow: optimistic -> call -> persist; on failure restore `cur`.
  const apply = async (p: FeedPost, kind: string, next: FeedPost, text?: string): Promise<boolean> => {
    const k = postKey(p);
    if (busy.includes(k)) return false;
    const cur = over[k] ?? p;
    setError(null);
    setBusy((b) => [...b, k]);
    setOver((o) => ({ ...o, [k]: next }));
    try {
      const done = { ...next, meta: { ...next.meta, ...(await call(cur, kind, text)) } };
      setOver((o) => ({ ...o, [k]: done }));
      await saveAction(done).catch(() => {}); // the action succeeded; persistence is best-effort
      return true;
    } catch (e) {
      setOver((o) => ({ ...o, [k]: cur }));
      setError(`${kind} failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      setBusy((b) => b.filter((x) => x !== k));
    }
  };

  return {
    view,
    busy,
    error,
    act: (p: FeedPost, kind: ActionKind) => { const cur = over[postKey(p)] ?? p; return apply(cur, kind, applyAction(cur, kind)); },
    reply: (p: FeedPost, text: string) => { const cur = over[postKey(p)] ?? p; return apply(cur, "reply", withReply(cur), text); },
  };
}
