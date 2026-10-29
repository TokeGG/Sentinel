import { useEffect, useMemo, useState } from "react";
import { loadEmoteSets } from "./emoteSets";
import { mergeSets, type EmoteSet } from "./emotes";

/** Global sets plus the channel's (once its Twitch room id is known). */
export function useEmoteSets(channelId: string | null): EmoteSet {
  const [glob, setGlob] = useState<EmoteSet>(new Map());
  const [chan, setChan] = useState<EmoteSet>(new Map());
  useEffect(() => void loadEmoteSets(null).then(setGlob), []);
  useEffect(() => {
    if (channelId) void loadEmoteSets(channelId).then(setChan);
  }, [channelId]);
  return useMemo(() => mergeSets(chan, glob), [chan, glob]);
}
