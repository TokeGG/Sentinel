// "Why am I seeing this?" popover: the top features behind an item's rank.
import { useState } from "react";
import type { Ranked } from "../core/taste/model";
import "./taste.css";

export function WhyBadge({ ranked }: { ranked: Pick<Ranked<unknown>, "why" | "explored"> }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ts-menu">
      <button type="button" className="ts-why" aria-expanded={open} title="Why am I seeing this?" onClick={() => setOpen(!open)}>Why?</button>
      {open && (
        <span className="ts-pop" role="note">
          {ranked.why.length === 0 && <span>{ranked.explored ? "A new source, shown so you can discover it." : "Nothing learned about this yet."}</span>}
          {ranked.why.map((w) => (
            <span key={w.feature} className={w.contrib >= 0 ? "ts-up" : "ts-down"}>{w.contrib >= 0 ? "Liked" : "Disliked"}: {w.label}</span>
          ))}
          {ranked.explored && ranked.why.length > 0 && <span>Also boosted to explore.</span>}
        </span>
      )}
    </span>
  );
}
