// 👍 👎 ⋮ for any card. Signals go to the module's local taste profile.
import { useState } from "react";
import type { Taste } from "../core/taste/useTaste";
import type { TasteItem } from "../core/taste/model";
import "./taste.css";

export function TasteButtons({ taste, item }: { taste: Taste; item: TasteItem }) {
  const [menu, setMenu] = useState(false);
  const mark = taste.marks[item.key];
  const send = (s: "like" | "dislike" | "dismiss" | "hide") => { setMenu(false); void taste.record(item, s); };
  if (taste.off) return null;
  return (
    <span className="ts-btns">
      <button type="button" className="ui-btn ui-sm" aria-pressed={mark === "like"} title="More like this" onClick={() => send("like")}>👍</button>
      <button type="button" className="ui-btn ui-sm" aria-pressed={mark === "dislike"} title="Less like this" onClick={() => send("dislike")}>👎</button>
      <span className="ts-menu">
        <button type="button" className="ui-btn ui-sm" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>⋮</button>
        {menu && (
          <span className="ts-pop" role="menu">
            <button type="button" role="menuitem" onClick={() => send("dismiss")}>Not interested</button>
            <button type="button" role="menuitem" onClick={() => send("hide")}>Hide this</button>
          </span>
        )}
      </span>
    </span>
  );
}
