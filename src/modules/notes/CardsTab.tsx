// Flashcards: `question :: answer` lines in any note become SM-2 cards; review the due ones.
import { useState } from "react";
import { EmptyState, ErrorLine } from "../../ui/kit";
import { useStore } from "../../ui/useStore";
import { isDue, review, type Grade } from "./sm2";
import { listCards, saveCard } from "./storeExtra";

const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export function CardsTab() {
  const s = useStore(listCards, []);
  const [shown, setShown] = useState(false);
  const due = s.data.filter((c) => isDue(c, new Date()));
  const c = due[0];
  return (
    <div className="nt-cards">
      {s.error && <ErrorLine message={s.error} />}
      <p className="ui-meta">{due.length} due · {s.data.length} cards. Write <code>Question :: Answer</code> on its own line in any note.</p>
      {!c ? <EmptyState title="Nothing due" hint="Come back tomorrow, or add more cards." /> : (
        <div className="nt-card">
          <p className="nt-q">{c.q}</p>
          {shown ? <p className="nt-a">{c.a}</p> : <button type="button" className="ui-btn primary" onClick={() => setShown(true)}>Show answer</button>}
          {shown && (
            <div className="ui-controls">
              {GRADES.map((g) => (
                <button key={g} type="button" className="ui-btn" disabled={s.busy}
                  onClick={() => void s.act(async () => { await saveCard({ ...c, ...review(c, g, new Date()) }); setShown(false); })}>{g}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
