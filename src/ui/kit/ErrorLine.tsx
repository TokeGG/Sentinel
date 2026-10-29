// Red banner for a failed action; dismissible when onDismiss is given.
export function ErrorLine({
  message,
  onDismiss,
  className,
}: {
  message: string;
  onDismiss?(): void;
  className?: string;
}) {
  return (
    <div className={`kit-error ${className ?? ""}`.trim()} role="alert">
      <span className="kit-error-text">{message}</span>
      {onDismiss && (
        <button type="button" className="kit-error-x" aria-label="Dismiss error" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}
