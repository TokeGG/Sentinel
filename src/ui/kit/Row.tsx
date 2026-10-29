import type { ReactNode } from "react";

// Flex row; `end` content is pushed to the right edge.
export function Row({
  end,
  className,
  children,
}: {
  end?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`kit-row ${className ?? ""}`.trim()}>
      <div className="kit-row-main">{children}</div>
      {end != null && <div className="kit-row-end">{end}</div>}
    </div>
  );
}
