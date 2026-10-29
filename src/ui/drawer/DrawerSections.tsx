// Show/hide and reorder the module's declared sections. Keyboard-only friendly:
// a checkbox plus move up/down buttons per row (no drag and drop); focus
// follows the moved row's button.
import { useRef } from "react";
import type { ModuleManifest } from "../../core/module";
import { reorderSections, setSectionVisible } from "../prefs";
import type { Customize } from "../useCustomize";

export function DrawerSections({ module: m, cz }: { module: ModuleManifest; cz: Customize }) {
  const list = useRef<HTMLOListElement>(null);
  const secs = cz.view.sections;
  if (secs.length === 0) return null;
  const label = new Map((m.customize?.sections ?? []).map((s) => [s.id, s.label]));

  const move = (i: number, dir: -1 | 1, id: string) => {
    void cz.setView(reorderSections(cz.view, i, i + dir));
    requestAnimationFrame(() => {
      const btns = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[data-move]") ?? []);
      const pick = (k: string) => btns.find((b) => b.dataset.move === k && !b.disabled);
      (pick(`${id}:${dir}`) ?? pick(`${id}:${-dir}`))?.focus();
    });
  };

  return (
    <section className="cz-sec" aria-labelledby="cz-secs">
      <h3 id="cz-secs">Sections</h3>
      <ol ref={list} className="cz-sections">
        {secs.map((s, i) => {
          const name = label.get(s.id) ?? s.id;
          return (
            <li key={s.id}>
              <label className="cz-check">
                <input
                  type="checkbox"
                  checked={s.visible}
                  onChange={(e) => void cz.setView(setSectionVisible(cz.view, s.id, e.target.checked))}
                />
                <span>{name}</span>
              </label>
              <button type="button" data-move={`${s.id}:-1`} aria-label={`Move ${name} up`}
                disabled={i === 0} onClick={() => move(i, -1, s.id)}>↑</button>
              <button type="button" data-move={`${s.id}:1`} aria-label={`Move ${name} down`}
                disabled={i === secs.length - 1} onClick={() => move(i, 1, s.id)}>↓</button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
