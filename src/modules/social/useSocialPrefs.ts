// Social feed preferences from the customize options (length filter, hide reposts, quiet hours),
// the shared spoiler list, and "save post to Notes" via the Notes capture_note skill.
import { useCallback, useEffect, useState } from "react";
import { registry } from "../../core/module";
import { findSkill } from "../../ui/moduleRun";
import { useOption } from "../../ui/useOption";
import { useSpoilers } from "../../ui/wordList";
import { applyFeedPrefs, inQuiet, noteBody } from "./feedPrefs";
import type { FeedPost } from "./panelLogic";

export function useSocialPrefs() {
  const minLen = useOption("minLen", 0);
  const maxLen = useOption("maxLen", 0);
  const hideReposts = useOption("hideReposts", false);
  const quietOn = useOption("quietOn", false);
  const from = useOption("quietFrom", 22);
  const to = useOption("quietTo", 7);
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => { const t = setInterval(() => setHour(new Date().getHours()), 60000); return () => clearInterval(t); }, []);
  const spoil = useSpoilers();
  const apply = useCallback((ps: FeedPost[]) => applyFeedPrefs(ps, { minLen, maxLen, hideReposts }), [minLen, maxLen, hideReposts]);
  const toNotes = useCallback(async (p: FeedPost) => {
    const notes = registry.find((m) => m.id === "hub.notes");
    if (!notes) throw new Error("The Notes module is not available");
    await findSkill(notes, "capture_note").run({ body: noteBody(p), tags: "social" });
  }, []);
  return { apply, quiet: quietOn && inQuiet(hour, from, to), quietTo: to, spoil, toNotes };
}
