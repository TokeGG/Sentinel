import { useState } from "react";
import { EmptyState, Row } from "../../ui/kit";
import { ConfirmButton } from "../../ui/ConfirmButton";
import type { ModuleState } from "../../ui/useModule";
import { ruleHost, setRule, SITE_RULE_LABEL, SITE_RULES, type SiteRule } from "./siteRules";
import type { More } from "./useMore";

/** Per-site rules the agent's gate enforces on every step (parent domains count: example.com covers shop.example.com). */
export function SiteRulesPane({ more, run, busy }: { more: More; run: ModuleState["run"]; busy: boolean }) {
  const [host, setHost] = useState("");
  const [rule, setR] = useState<SiteRule>("nobuy");
  const rules = more.cfg?.rules ?? {};
  const put = async (h: string, r: SiteRule | null) => { if ((await run("save_site_rules", { rules: setRule(rules, h, r) })) !== undefined) { setHost(""); void more.reload(); } };
  return (
    <div className="bot-goal">
      <p className="ui-meta">Read-only: only links, scrolling and navigation. Never click buy/submit: no submit, purchase, delete or login, and no buttons labelled buy/pay/checkout/submit.</p>
      <div className="ui-quickadd">
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Site, e.g. shop.example" aria-label="Site for rule" />
        <select className="ui-select" value={rule} onChange={(e) => setR(e.target.value as SiteRule)} aria-label="Rule">
          {SITE_RULES.map((r) => <option key={r} value={r}>{SITE_RULE_LABEL[r]}</option>)}
        </select>
        <button type="button" className="ui-btn" disabled={busy || !ruleHost(host)} onClick={() => void put(host, rule)}>Set</button>
      </div>
      {Object.keys(rules).length === 0 ? <EmptyState title="No site rules" hint="Every site uses the normal rules (irreversible actions ask first)." /> : Object.entries(rules).map(([h, r]) => (
        <Row key={h} end={<span className="ui-actions">
          <select className="ui-select" value={r} disabled={busy} aria-label={`Rule for ${h}`} onChange={(e) => void put(h, e.target.value as SiteRule)}>
            {SITE_RULES.map((x) => <option key={x} value={x}>{SITE_RULE_LABEL[x]}</option>)}
          </select>
          <ConfirmButton label="Remove" disabled={busy} onConfirm={() => void put(h, null)} />
        </span>}><strong>{h}</strong></Row>
      ))}
    </div>
  );
}
