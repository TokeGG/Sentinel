// Home widget grid: drag a widget's title bar to move it, its corner to resize, x to unpin.
// Unpinned widgets wait in the tray at the bottom; drag one up onto the grid (or click it) to pin it.
import { useRef, useState, type ReactNode } from "react";
import { addWidget, cellAt, COLS, moveWidget, removeWidget, resizeWidget, type Widget } from "./widgetLayout";

const ROW_H = 56;
type Props = { list: Widget[]; update(f: (l: Widget[]) => Widget[]): void; all: { id: string; title: string }[]; render(id: string): ReactNode };

export function WidgetGrid({ list, update, all, render }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const [tray, setTray] = useState(false);
  const cell = (x: number, y: number) => { const b = grid.current!.getBoundingClientRect(); return cellAt(x, y + grid.current!.scrollTop, b, ROW_H); };
  const drag = (id: string, mode: "move" | "size") => (e: React.PointerEvent) => {
    e.preventDefault();
    const g = list.find((w) => w.id === id)!, start = cell(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => {
      const c = cell(ev.clientX, ev.clientY), dx = c.x - start.x, dy = c.y - start.y;
      update((l) => (mode === "move" ? moveWidget(l, id, g.x + dx, g.y + dy) : resizeWidget(l, id, g.w + dx, g.h + dy)));
    };
    const up = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", up);
  };
  const title = (id: string) => all.find((a) => a.id === id)?.title ?? id;
  const unpinned = all.filter((a) => !list.some((w) => w.id === a.id));
  return (
    <>
      <div ref={grid} className="wg-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridAutoRows: ROW_H }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { const id = e.dataTransfer.getData("text/widget"); if (id) update((l) => addWidget(l, id, cell(e.clientX, e.clientY))); }}>
        {list.map((w) => (
          <section key={w.id} className="wg-item" style={{ gridColumn: `${w.x + 1} / span ${w.w}`, gridRow: `${w.y + 1} / span ${w.h}` }} aria-label={title(w.id)}>
            <header className="wg-bar" onPointerDown={drag(w.id, "move")}><span>{title(w.id).toUpperCase()}</span>
              <button type="button" className="wg-x" aria-label={`Unpin ${title(w.id)}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => update((l) => removeWidget(l, w.id))}>x</button></header>
            <div className="wg-body">{render(w.id)}</div>
            <span className="wg-size" role="separator" aria-label={`Resize ${title(w.id)}`} onPointerDown={drag(w.id, "size")} />
          </section>
        ))}
      </div>
      <div className={`wg-tray${tray ? " open" : ""}`}>
        <button type="button" className="wg-tray-btn" onClick={() => setTray(!tray)}>{tray ? "v widgets" : `^ widgets (${unpinned.length} to pin)`}</button>
        {tray && <div className="wg-tray-list">{unpinned.length ? unpinned.map((a) => (
          <button key={a.id} type="button" draggable className="wg-chip" onDragStart={(e) => e.dataTransfer.setData("text/widget", a.id)} onClick={() => update((l) => addWidget(l, a.id))}>{a.title}</button>
        )) : <span className="term-dim">every widget is pinned</span>}</div>}
      </div>
    </>
  );
}
