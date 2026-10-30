// Per-site bot rules (app_settings `bot_site_rules`, JSON {host: rule}), enforced by the agent's action gate. Pure.
//   allowed  = normal rules (irreversible actions still ask first)
//   nobuy    = never submit/purchase/login/delete, and never click an element labelled like buy/pay/checkout/submit
//   readonly = only look: goto, scroll, wait and plain clicks on links; no typing, keys, forms or irreversible actions
import type { Action, Observation } from "./actions.ts";
import { hostOf } from "./siteNotes.ts";

export type SiteRule = "allowed" | "nobuy" | "readonly";
export const SITE_RULES: readonly SiteRule[] = ["allowed", "nobuy", "readonly"];
export const SITE_RULE_LABEL: Record<SiteRule, string> = { allowed: "Allowed", nobuy: "Never click buy/submit", readonly: "Read-only" };
export const SITE_RULES_KEY = "bot_site_rules";
export type SiteRules = Record<string, SiteRule>;

export function parseSiteRules(json: string | null): SiteRules {
  try {
    const o = JSON.parse(json ?? "{}");
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o).filter(([h, r]) => hostOf(`https://${h}`) === h && SITE_RULES.includes(r as SiteRule))) as SiteRules;
  } catch { return {}; }
}

/** Normalises a typed site ("https://www.Shop.test/x") to its host, or "" when it is not one. */
export const ruleHost = (input: string) => hostOf(`https://${input.trim().replace(/^https?:\/\//i, "")}`);

export function setRule(rules: SiteRules, host: string, rule: SiteRule | null): SiteRules {
  const h = ruleHost(host);
  if (!h) return rules;
  const next = { ...rules };
  if (rule) next[h] = rule; else delete next[h];
  return next;
}

/** The rule for a URL: exact host first, then any parent domain (shop.example.com -> example.com). */
export function ruleFor(rules: SiteRules, url: string): SiteRule {
  const parts = hostOf(url).split(".");
  for (let i = 0; i < parts.length - 1; i++) { const r = rules[parts.slice(i).join(".")]; if (r) return r; }
  return "allowed";
}

const BUY = /\b(buy|pay|checkout|check out|place order|order now|purchase|submit|send|confirm|subscribe|donate|add to cart|sign up)\b/i;
const NO_BUY_TYPES = new Set(["submit", "purchase", "delete", "login"]);
const READ_TYPES = new Set(["goto", "scroll", "wait", "click", "done", "fail", "tool"]);

/** Verdict for one action on the page `obs`. Tool actions are left to the tool gate; goto is judged by its target. */
export function siteRuleVerdict(rules: SiteRules, action: Action, obs?: Observation): { allowed: boolean; reason: string } {
  const url = action.type === "goto" ? action.url : obs?.url ?? "";
  const rule = ruleFor(rules, url);
  if (rule === "allowed" || action.type === "goto") return { allowed: true, reason: "" };
  const el = "target" in action ? obs?.elements.find((e) => e.id === action.target) : undefined;
  const buyish = !!el && BUY.test(el.text);
  const host = hostOf(url);
  if (rule === "readonly") {
    if (!READ_TYPES.has(action.type)) return { allowed: false, reason: `${host} is read-only (${action.type} not allowed)` };
    if (action.type === "click" && (buyish || (el && /button|checkbox|radio|menuitem|textbox/.test(el.role) && !/link/.test(el.role))))
      return { allowed: false, reason: `${host} is read-only (only links may be clicked)` };
    return { allowed: true, reason: "" };
  }
  if (NO_BUY_TYPES.has(action.type)) return { allowed: false, reason: `${host}: never buy/submit (${action.type})` };
  if (buyish) return { allowed: false, reason: `${host}: never buy/submit ("${el!.text.slice(0, 40)}")` };
  return { allowed: true, reason: "" };
}
