import type { ReactNode } from "react";

// Labelled on/off switch (a native checkbox, so keyboard + a11y come free).
export function Switch({ checked, disabled, onChange, children }: {
  checked: boolean; disabled?: boolean; onChange(next: boolean): void; children: ReactNode;
}) {
  return (
    <label className="st-switch">
      <input type="checkbox" role="switch" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Head({ children }: { children: ReactNode }) {
  return <h2 className="ui-head"><span className="ui-dot" />{children}</h2>;
}
