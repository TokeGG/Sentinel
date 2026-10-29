// Right-side customize drawer, overlaying the panel body inside the panel's
// own webview. Modal: Esc or the backdrop closes it, Tab is trapped inside,
// and focus returns to whatever had it before opening.
import { useEffect, useRef } from "react";
import type { ModuleManifest } from "../core/module";
import type { Customize } from "./useCustomize";
import { DrawerAppearance } from "./drawer/DrawerAppearance";
import { DrawerOptions } from "./drawer/DrawerOptions";
import { DrawerSections } from "./drawer/DrawerSections";
import { DrawerViews } from "./drawer/DrawerViews";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

export function CustomizeDrawer({
  module: m,
  cz,
  onClose,
}: {
  module: ModuleManifest;
  cz: Customize;
  onClose(): void;
}) {
  const box = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const els = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const [first, last] = [els[0], els[els.length - 1]];
      const inside = box.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

  return (
    <>
      <div className="cz-backdrop" onClick={onClose} />
      <aside ref={box} className="cz-drawer" role="dialog" aria-modal="true" aria-label={`Customize ${m.name}`}>
        <header className="cz-head">
          <h2>Customize</h2>
          <button type="button" className="cz-x" aria-label="Close customize" onClick={onClose}>
            ×
          </button>
        </header>
        <DrawerAppearance cz={cz} />
        <DrawerOptions module={m} cz={cz} />
        <DrawerSections module={m} cz={cz} />
        <DrawerViews module={m} cz={cz} />
      </aside>
    </>
  );
}
