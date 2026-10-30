import { useStore } from "../../ui/useStore";
import { MOODS, moodAvg, validMood } from "./prod";
import { listMoods, setMood } from "./prodStore";

/** Journal mood for today (1-5) + 7-entry average and a small history strip. */
export function MoodPicker({ day }: { day: string }) {
  const moods = useStore(listMoods, []);
  const today = moods.data.find((m) => m.day === day);
  const avg = moodAvg(moods.data);
  return (
    <div className="nt-mood">
      <span className="ui-meta">Mood today:</span>
      {MOODS.map((m, i) => (
        <button key={m} type="button" className={`ui-btn ui-sm${today?.mood === i + 1 ? " primary" : ""}`} aria-pressed={today?.mood === i + 1}
          onClick={() => void moods.act(() => setMood(day, validMood(i + 1), today?.note ?? ""))}>{m}</button>
      ))}
      {avg !== null && <span className="ui-meta">7-day average {avg}/5</span>}
      <span className="nt-moodstrip" aria-hidden>{[...moods.data].slice(0, 14).reverse().map((m) => <i key={m.day} title={`${m.day}: ${MOODS[m.mood - 1]}`} style={{ height: `${m.mood * 4}px` }} />)}</span>
    </div>
  );
}
