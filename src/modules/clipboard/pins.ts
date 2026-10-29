// Pinned clip ids: a per-viewer convenience kept in localStorage (may be unavailable; then pins last until the panel closes).
import { useState } from "react";

const KEY = "sentinel.clipboard.pins";

function read(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function usePins(): [Set<string>, (id: string) => void] {
  const [pins, setPins] = useState(read);
  const toggle = (id: string) =>
    setPins((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...n]));
      } catch {
        /* storage blocked: keep in memory only */
      }
      return n;
    });
  return [pins, toggle];
}
