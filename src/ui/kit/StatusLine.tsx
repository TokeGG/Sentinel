import { useEffect, useState } from "react";
import { statusText } from "./format";

// Sticky footer line: "Updated 5m ago · Auto-refresh 5 min" or the error.
// Re-renders every 30s so the relative age stays current.
export function StatusLine({
  updated,
  autoRefresh,
  error,
  className,
}: {
  updated?: Date | string | null;
  autoRefresh?: string | null;
  error?: string | null;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className={`kit-status${error ? " bad" : ""} ${className ?? ""}`.trim()} role="status">
      {statusText(updated, autoRefresh, error, now)}
    </footer>
  );
}
