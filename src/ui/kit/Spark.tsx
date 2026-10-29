import { sparkPoints } from "./format";

const W = 80;
const H = 22;

// Tiny inline sparkline; color comes from tone (up=ok, down=bad, flat=dim).
export function Spark({
  points,
  tone = "flat",
  className,
}: {
  points: number[];
  tone?: "up" | "down" | "flat";
  className?: string;
}) {
  const pts = sparkPoints(points, W, H - 2);
  return (
    <svg
      className={`kit-spark ${tone} ${className ?? ""}`.trim()}
      viewBox={`0 -1 ${W} ${H}`}
      width={W}
      height={H}
      aria-hidden="true"
    >
      {pts && <polyline points={pts} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
