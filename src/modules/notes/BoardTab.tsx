import { useState } from "react";
import { ConfirmButton } from "../../ui/ConfirmButton";
import { useStore } from "../../ui/useStore";
import { boards, byCol, nextPos, shiftCol } from "./prod";
import { addCard, deleteCard, listCards, moveCard } from "./prodStore";

const LABEL = { todo: "To do", doing: "Doing", done: "Done" };

/** Kanban boards: three columns, move cards left/right. */
export function BoardTab() {
  const cards = useStore(listCards, []);
  const [board, setBoard] = useState("Main");
  const [title, setTitle] = useState("");
  const [newBoard, setNewBoard] = useState("");
  const list = boards(cards.data).includes(board) ? boards(cards.data) : [...boards(cards.data), board];
  return (
    <div className="nt-board">
      {cards.error && <div className="ui-error">{cards.error}</div>}
      <div className="ui-controls">
        {list.map((b) => <button key={b} type="button" className={`ui-btn${b === board ? " primary" : ""}`} onClick={() => setBoard(b)}>{b}</button>)}
        <input placeholder="New board" value={newBoard} onChange={(e) => setNewBoard(e.target.value)} aria-label="New board" />
        <button type="button" className="ui-btn" disabled={!newBoard.trim()} onClick={() => { setBoard(newBoard.trim()); setNewBoard(""); }}>Create</button>
      </div>
      <form className="ui-controls" onSubmit={(e) => { e.preventDefault(); const t = title.trim(); setTitle(""); void cards.act(() => addCard(board, "todo", t, nextPos(cards.data, board, "todo"))); }}>
        <input placeholder="Add a card" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Card title" />
        <button className="ui-btn" disabled={!title.trim()}>Add</button>
      </form>
      <div className="nt-cols">
        {byCol(cards.data, board).map(({ col, cards: cs }) => (
          <section key={col} className="nt-col"><h4>{LABEL[col]} · {cs.length}</h4>
            {cs.map((c) => (
              <div key={c.id} className="nt-kcard">
                <span>{c.title}</span>
                <span className="ui-controls">
                  {(["-1", "1"] as const).map((d) => { const to = shiftCol(col, Number(d) as -1 | 1); return to && <button key={d} type="button" className="ui-btn ui-sm" aria-label={`Move to ${LABEL[to]}`} onClick={() => void cards.act(() => moveCard(c.id, to, nextPos(cards.data, board, to)))}>{d === "1" ? ">" : "<"}</button>; })}
                  <ConfirmButton label="x" className="ui-btn ui-sm" onConfirm={() => void cards.act(() => deleteCard(c.id))} />
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
