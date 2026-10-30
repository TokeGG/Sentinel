// Finance Plan section: Subscriptions / Afford / Goals / Dividends / Net worth / Report / CSV / Settings.
import { useEffect, useState } from "react";
import { Tabs } from "../../ui/kit";
import type { ModuleState } from "../../ui/useModule";
import { listSubs } from "../calendar/extraStore";
import { listBills, listBudgets, spentByCategory } from "./extraStore";
import { getPlan, type Plan as PlanData } from "./planStore";
import { recurringCharges, type Recurring } from "./plan";
import type { FinPrefs } from "./prefs";
import { AffordPart, DividendsPart, GoalsPart, SubsPart } from "./PlanMoney";
import { CsvPart, ReportPart, WorthPart } from "./PlanWorth";
import { SettingsPart } from "./PlanSettings";

const TABS = [
  { id: "subs", label: "Subscriptions" }, { id: "afford", label: "Afford?" }, { id: "goals", label: "Goals" },
  { id: "divs", label: "Dividends" }, { id: "worth", label: "Net worth" }, { id: "report", label: "Report" },
  { id: "csv", label: "Import/Export" }, { id: "settings", label: "Settings" },
];

export type PlanState = {
  plan: PlanData; recurring: Recurring[]; budgets: { category: string; monthly: number }[]; spent: Map<string, number>;
};
export type PlanProps = { s: PlanState; prefs: FinPrefs; busy: boolean; act: (skill: string, args?: Record<string, unknown>) => Promise<void> };

const empty: PlanState = { plan: { goals: [], dividends: [], worth: [], reminded: [] }, recurring: [], budgets: [], spent: new Map() };

export function Plan({ prefs, busy, run, version }: { prefs: FinPrefs; busy: boolean; run: ModuleState["run"]; version: unknown }) {
  const [tab, setTab] = useState("subs");
  const [s, setS] = useState<PlanState>(empty);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7);
    void Promise.all([getPlan(), listSubs().catch(() => []), listBills(), listBudgets(), spentByCategory(month)])
      .then(([plan, subs, bills, budgets, spent]) => setS({ plan, recurring: recurringCharges(subs, bills, new Date()), budgets, spent }))
      .catch(() => {});
  }, [tick, version]);
  const act = async (skill: string, args?: Record<string, unknown>) => { await run(skill, args); setTick((t) => t + 1); };
  const p: PlanProps = { s, prefs, busy, act };
  return (
    <div className="fin-tools fin-plan">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "subs" && <SubsPart {...p} />}
      {tab === "afford" && <AffordPart {...p} />}
      {tab === "goals" && <GoalsPart {...p} />}
      {tab === "divs" && <DividendsPart {...p} />}
      {tab === "worth" && <WorthPart {...p} />}
      {tab === "report" && <ReportPart {...p} />}
      {tab === "csv" && <CsvPart {...p} />}
      {tab === "settings" && <SettingsPart {...p} />}
    </div>
  );
}
