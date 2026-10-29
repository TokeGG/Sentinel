import { useRef, type KeyboardEvent } from "react";

// WAI-ARIA tabs: role=tablist, roving tabindex, Left/Right/Home/End keys.
export function Tabs({
  tabs,
  active,
  onChange,
  className,
  disabled,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange(id: string): void;
  className?: string;
  disabled?: boolean; // e.g. while a fetch is running
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active));

  function onKey(e: KeyboardEvent) {
    const n = tabs.length;
    const next =
      e.key === "ArrowRight" ? (idx + 1) % n
      : e.key === "ArrowLeft" ? (idx - 1 + n) % n
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : -1;
    if (disabled || next < 0 || n === 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className={`kit-tabs ${className ?? ""}`.trim()} role="tablist" onKeyDown={onKey}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="tab"
          className={`kit-tab${i === idx ? " on" : ""}`}
          aria-selected={i === idx}
          disabled={disabled}
          tabIndex={i === idx ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
