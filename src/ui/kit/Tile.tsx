import type { ReactNode } from "react";

export function Tile({
  title,
  className,
  children,
}: {
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`kit-tile ${className ?? ""}`.trim()}>
      {title != null && <h3 className="kit-tile-title">{title}</h3>}
      {children}
    </section>
  );
}
