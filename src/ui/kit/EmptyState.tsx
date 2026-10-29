export function EmptyState({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`kit-empty ${className ?? ""}`.trim()}>
      <p className="kit-empty-title">{title}</p>
      {hint && <p className="kit-empty-hint">{hint}</p>}
    </div>
  );
}
