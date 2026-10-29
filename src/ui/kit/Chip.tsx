import type { ReactNode } from "react";

// A small pill button. When `on` is defined it is a toggle (aria-pressed).
export function Chip({
  on,
  onClick,
  className,
  children,
}: {
  on?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`kit-chip${on ? " on" : ""} ${className ?? ""}`.trim()}
      aria-pressed={on === undefined ? undefined : on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
