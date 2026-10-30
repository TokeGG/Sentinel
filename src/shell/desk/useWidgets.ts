// Home widgets layout (app_settings `home_widgets`); first run builds it from the old Terminal box order.
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "../../ui/appSetting";
import { defaultWidgets, parseWidgets, type Widget } from "./widgetGrid";

export function useWidgets(seed: string[]): [Widget[], (f: (l: Widget[]) => Widget[]) => void] {
  const [list, setList] = useState<Widget[]>([]);
  useEffect(() => { getSetting("home_widgets").then((s) => setList(parseWidgets(s) ?? defaultWidgets(seed))).catch(() => setList(defaultWidgets(seed))); }, []);
  const update = (f: (l: Widget[]) => Widget[]) => setList((prev) => {
    const next = f(prev);
    setSetting("home_widgets", JSON.stringify(next)).catch(() => {});
    return next;
  });
  return [list, update];
}
