// Generic "comma-separated words in app_settings JSON" hook + editor (spoiler words, block lists,
// alert words) and the spoiler gate with its Reveal button.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { parseWords, readWords, SPOILER_KEY } from "../core/spoiler";
import { getSetting, setSetting } from "./appSetting";

export function useWordList(key: string) {
  const [words, setWords] = useState<string[]>([]);
  useEffect(() => { getSetting(key).then((v) => setWords(readWords(v))).catch(() => {}); }, [key]);
  const save = useCallback((next: string[]) => { setWords(next); void setSetting(key, JSON.stringify(next)).catch(() => {}); }, [key]);
  return { words, save };
}
export const useSpoilers = () => useWordList(SPOILER_KEY);

export function WordListInput({ label, words, save, placeholder }: { label: string; words: string[]; save: (w: string[]) => void; placeholder?: string }) {
  return (
    <label className="ui-meta">
      {label}{" "}
      <input className="ui-file-text" key={words.join(",")} defaultValue={words.join(", ")} placeholder={placeholder} aria-label={label}
        onBlur={(e) => save(parseWords(e.target.value))} />
    </label>
  );
}

export const SpoilerWords = ({ words, save }: { words: string[]; save: (w: string[]) => void }) => (
  <WordListInput label="Spoiler words (hidden in Chat, Social and News):" words={words} save={save} placeholder="finale, final score…" />
);

export function SpoilerGate({ hit, children }: { hit: string | null; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  if (!hit || shown) return <>{children}</>;
  return (
    <div className="ui-meta">
      Hidden: matches muted word “{hit}”.{" "}
      <button type="button" className="ui-btn ui-sm" onClick={() => setShown(true)}>Reveal</button>
    </div>
  );
}
