import { useState } from "react";
import type { ModuleManifest } from "../../core/module";
import { CredentialFields } from "../../core/panel/CredentialFields";
import type { Plan } from "./install";
import type { ModuleState } from "../../ui/useModule";

const NPX_HINT = "MCP servers need Node.js (npx) or Python (uvx) already installed.";

export function InstallPane({ module, busy, run, onPlan }: { module: ModuleManifest; busy: boolean; run: ModuleState["run"]; onPlan(p: Plan): void }) {
  const [f, setF] = useState({ input: "", kind: "skill", command: "", env: "", secrets: "", flagged: "", bundle: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const mcp = f.kind === "mcp";
  return (
    <form className="sk-form" onSubmit={async (e) => {
      e.preventDefault();
      const p = (await run("plan_install", f)) as Plan | undefined;
      if (p) onPlan(p);
    }}>
      <div className="ui-quickadd">
        <input value={f.input} onChange={set("input")} disabled={busy} placeholder="owner/repo, github.com URL, owner/repo@ref:subdir" aria-label="GitHub repository" />
        <select className="ui-select" value={f.kind} onChange={set("kind")} aria-label="What to install">
          <option value="skill">Skill</option>
          <option value="mcp">MCP server</option>
        </select>
        <button type="submit" className="ui-btn primary" disabled={busy || !f.input.trim()}>Review</button>
      </div>
      {mcp && <>
        <input className="ui-file-text" value={f.command} onChange={set("command")} placeholder="Command, e.g. npx -y @scope/server (or leave empty to use the repo's sentinel-mcp.json)" aria-label="Command" />
        <textarea className="ui-file-text" rows={2} value={f.env} onChange={set("env")} placeholder="Plain env, one NAME=value per line (never put secrets here)" aria-label="Plain environment" />
        <input className="ui-file-text" value={f.secrets} onChange={set("secrets")} placeholder="Secret env var NAMES, comma separated (values are asked for after install)" aria-label="Secret names" />
        <input className="ui-file-text" value={f.flagged} onChange={set("flagged")} placeholder="Tool names/categories to treat as pentest-gated (optional)" aria-label="Flagged tools" />
        <input className="ui-file-text" value={f.bundle} onChange={set("bundle")} placeholder="Module bundle, e.g. hub.pentest (optional)" aria-label="Bundle" />
        <span className="ui-meta">{NPX_HINT}</span>
      </>}
      <details className="ui-token">
        <summary>GitHub token for rate limits (optional, stored in the OS keychain)</summary>
        <CredentialFields module={module} onSaved={() => undefined} />
      </details>
    </form>
  );
}
