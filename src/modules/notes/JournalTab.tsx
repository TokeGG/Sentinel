// Journal: opt-in daily note (created when the panel opens), today's prompt, on-this-day.
import { useEffect } from "react";
import { getSetting, setSetting } from "../../ui/appSetting";
import { useStore } from "../../ui/useStore";
import { dailyBody, findDaily, onThisDay, promptFor } from "./journal";
import { noteTitle } from "./noteLogic";
import { DAILY_KEY } from "./panelLogic";
import { createNote } from "./store";
import type { NotesStore } from "./useNotes";

/** Creates today's daily note once per open when the user opted in. */
export function useDailyNote(store: NotesStore) {
  const loaded = store.data.length > 0 || !store.busy;
  useEffect(() => {
    if (!loaded) return;
    void getSetting(DAILY_KEY).then((v) => {
      if (v === "1" && !findDaily(store.data, new Date())) void store.act(() => createNote(dailyBody(new Date()), "Journal"));
    }).catch(() => {});
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function JournalTab({ store, open }: { store: NotesStore; open(id: number): void }) {
  const opt = useStore(() => getSetting(DAILY_KEY), null);
  const now = new Date();
  const today = findDaily(store.data, now);
  const past = onThisDay(store.data, now);
  const make = () => store.act(async () => open(await createNote(dailyBody(now), "Journal")));
  return (
    <div className="nt-journal">
      <label className="ui-meta">
        <input type="checkbox" checked={opt.data === "1"} onChange={(e) => void opt.act(() => setSetting(DAILY_KEY, e.target.checked ? "1" : "0"))} />{" "}
        Create a daily note automatically when Notes opens
      </label>
      <blockquote className="nt-prompt">{promptFor(now)}</blockquote>
      {today ? <button type="button" className="ui-btn primary" onClick={() => open(today.id)}>Open today's note</button>
        : <button type="button" className="ui-btn primary" onClick={() => void make()}>Start today's note</button>}
      <h4>On this day · {past.length}</h4>
      {past.map((n) => <button key={n.id} type="button" className="ui-link" onClick={() => open(n.id)}>{noteTitle(n.body)}</button>)}
      {!past.length && <span className="ui-meta">No daily notes from this date in earlier years yet.</span>}
    </div>
  );
}
