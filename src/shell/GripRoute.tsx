// 16px resize grip: its own child webview at the panel's bottom-right corner
// (the content webview covers the panel body, so the grip must be a sibling
// overlay, not part of the chrome strip).
import { registry } from "../core/module";
import { useDragPanel } from "./useDragPanel";

const PREFIX = "#/grip/";
export function gripIdFromHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    return decodeURIComponent(hash.slice(PREFIX.length));
  } catch {
    return "";
  }
}

export function GripRoute({ id }: { id: string }) {
  const min = registry.find((x) => x.id === id)?.web?.min;
  const { handlers } = useDragPanel(id, "resize", min);
  return <div className="panel-grip" title="Resize" {...handlers} />;
}
