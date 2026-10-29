// Watch-view player with a bottom-right drag handle: 16:9 locked, width clamped to
// [320, container], persisted as app_settings `yt_player_size` (width px; empty = fill).
import { useEffect, useRef, useState, type ComponentProps, type PointerEvent } from "react";
import { getSetting, setSetting } from "../../ui/appSetting";
import { Player } from "./Player";
import { clampWidth, SIZE_KEY } from "./queue";

export function ResizablePlayer(p: ComponentProps<typeof Player>) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  const drag = useRef<{ x: number; w: number } | null>(null);
  useEffect(() => { getSetting(SIZE_KEY).then((v) => v && setW(Number(v) || null)).catch(() => {}); }, []);
  const max = () => box.current?.parentElement?.clientWidth ?? 1200;
  const down = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: box.current?.offsetWidth ?? 640 };
  };
  const move = (e: PointerEvent) => { if (drag.current) setW(clampWidth(drag.current.w + e.clientX - drag.current.x, max())); };
  const up = () => { if (drag.current && w) void setSetting(SIZE_KEY, String(w)).catch(() => {}); drag.current = null; };
  return (
    <div ref={box} className="yt-resize" style={w ? { width: clampWidth(w, max()) } : undefined}>
      <Player {...p} />
      <span className="yt-resize-h" role="separator" aria-label="Resize player" title="Drag to resize (double-click: fill)"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onDoubleClick={() => { setW(null); void setSetting(SIZE_KEY, "").catch(() => {}); }} />
    </div>
  );
}
