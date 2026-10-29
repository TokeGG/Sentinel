// Main window: translucent preview of the snap zone a panel will fill on release.
// Drawn in the main webview, so panels above it can hide parts of it.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { Rect } from "../layout";
import { SNAP_PREVIEW } from "./dragSnap";
import { loadSnapPrefs } from "./snapPrefs";

export function SnapPreview() {
  const [r, setR] = useState<Rect | null>(null);
  useEffect(() => {
    loadSnapPrefs().catch(() => {}); // mirror app_settings into localStorage for chrome webviews
    const un = listen<{ rect: Rect | null }>(SNAP_PREVIEW, ({ payload }) => setR(payload?.rect ?? null));
    return () => void un.then((f) => f());
  }, []);
  if (!r) return null;
  return <div className="snap-preview" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} aria-hidden />;
}
