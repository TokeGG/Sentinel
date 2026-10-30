import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ModuleManifest } from "../../core/module";
import { ErrorLine, Tile } from "../../ui/kit";
import { Section, Sections } from "../../ui/useCustomize";
import { useModule } from "../../ui/useModule";
import { ConfirmPlan } from "./ConfirmPlan";
import { InstallPane } from "./InstallPane";
import { ItemList } from "./ItemList";
import { MarketPane } from "./MarketPane";
import { ModelPane } from "./ModelPane";
import { SkillBuilder } from "./SkillBuilder";
import type { Plan } from "./install";
import type { Item } from "./panelLogic";
import "./skills.css";

export default function Panel({ module }: { module: ModuleManifest }) {
  const { rows, busy, error, run, refresh } = useModule(module);
  const [plan, setPlan] = useState<Plan | null>(null);
  const items = rows as unknown as Item[];
  // Game mode stops every MCP server in Rust; re-read so the toggles tell the truth.
  useEffect(() => {
    const un = listen("game-mode", () => void refresh());
    return () => void un.then((f) => f());
  }, [refresh]);
  return (
    <div className="sk-root">
      <h2 className="ui-head"><span className="ui-dot" />{module.name}<span className="ui-count">{items.length}</span></h2>
      {error && <ErrorLine message={error} />}
      {plan && (
        <ConfirmPlan plan={plan} busy={busy} onCancel={() => setPlan(null)}
          onConfirm={async () => { if ((await run("confirm_plan", { plan })) !== undefined) setPlan(null); }} />
      )}
      <Sections>
        <Section id="skills"><Tile title="Skills"><ItemList items={items.filter((i) => i.kind === "skill")} busy={busy} run={run} onPlan={setPlan} empty="No skills" /></Tile></Section>
        <Section id="servers"><Tile title="MCP servers (off until you switch them on)"><ItemList items={items.filter((i) => i.kind === "mcp")} busy={busy} run={run} onPlan={setPlan} empty="No MCP servers" /></Tile></Section>
        <Section id="install"><Tile title="Install from GitHub"><InstallPane module={module} busy={busy} run={run} onPlan={setPlan} /></Tile></Section>
        <Section id="market"><Tile title="Marketplace (suggested, verify before install)"><MarketPane busy={busy} run={run} onPlan={setPlan} /></Tile></Section>
        <Section id="model"><Tile title="Local model (used by the Browser Bot)"><ModelPane busy={busy} run={run} /></Tile></Section>
        <Section id="build"><Tile title="Skill builder (local model drafts, you review)"><SkillBuilder busy={busy} run={run} refresh={() => void refresh()} /></Tile></Section>
      </Sections>
    </div>
  );
}
