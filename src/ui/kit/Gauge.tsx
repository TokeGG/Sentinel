import { gaugeTone, pct } from "./format";

// Horizontal bar with a value readout. Turns warn at `warnAt` (default 75% of
// max) and bad at 90% of max.
export function Gauge({
  value,
  max = 100,
  label,
  warnAt,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  warnAt?: number;
  className?: string;
}) {
  const p = pct(value, max);
  const tone = gaugeTone(value, max, warnAt);
  const shown = Number.isFinite(value) ? Math.round(value * 10) / 10 : "—";
  return (
    <div className={`kit-gauge ${tone} ${className ?? ""}`.trim()}>
      <div className="kit-gauge-head">
        {label && <span className="kit-gauge-label">{label}</span>}
        <span className="kit-gauge-value">
          {shown}
          {max !== 100 ? ` / ${max}` : "%"}
        </span>
      </div>
      <div
        className="kit-gauge-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Number.isFinite(value) ? value : 0}
      >
        <div className="kit-gauge-fill" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
