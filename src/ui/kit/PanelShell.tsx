import type { CSSProperties, ReactNode } from "react";
import { onAccent, safeVars } from "./format";

// Panel root: applies the per-panel prefs variables and the dark panel surface
// (background, text, body font × --font-scale, spacing × --density), so any
// content inside — kit components or the generic ModulePanel — looks
// consistent. Values are untrusted (prefs rows / imported JSON): safeVars
// keeps only a hex accent and plain finite numbers, never raw CSS. The label
// color on the accent is a fixed token chosen by WCAG contrast.
const HEX = /^#[0-9a-f]{6}$/i;

export function PanelShell({
  accent,
  vars,
  className,
  children,
}: {
  accent?: string;
  vars?: Record<string, string>;
  className?: string;
  children?: ReactNode;
}) {
  const style: Record<string, string> = safeVars(vars);
  if (accent && HEX.test(accent)) style["--accent"] = accent;
  if (style["--accent"]) {
    style["--on-accent"] =
      onAccent(style["--accent"]) === "dark" ? "var(--on-accent-dark)" : "var(--on-accent-light)";
  }
  return (
    <div className={`panel-shell ${className ?? ""}`.trim()} style={style as CSSProperties}>
      {children}
    </div>
  );
}
