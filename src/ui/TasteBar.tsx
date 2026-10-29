// The adopting panels' control row: "For you" sort toggle + Tune drawer.
import { useState } from "react";
import type { Taste } from "../core/taste/useTaste";
import { Chip } from "./kit";
import { TasteDrawer } from "./TasteDrawer";
import "./taste.css";

export function TasteBar({ taste, name, forYou, onForYou }: { taste: Taste; name: string; forYou: boolean; onForYou(v: boolean): void }) {
  const [tune, setTune] = useState(false);
  return (
    <div className="ts-bar">
      <Chip on={forYou && !taste.off} onClick={() => onForYou(!forYou)}>For you</Chip>
      <button type="button" className="ui-btn ui-sm" onClick={() => setTune(true)}>Tune</button>
      {taste.off && <span className="ui-meta">Learning is off</span>}
      {tune && <TasteDrawer taste={taste} name={name} onClose={() => setTune(false)} />}
    </div>
  );
}
