// Finance tools section: Portfolio / Crypto / Alerts / Budgets / Bills / Vault sub-tabs.
import { useEffect, useState } from "react";
import { Tabs } from "../../ui/kit";
import type { ModuleRow, ModuleState } from "../../ui/useModule";
import { listAlerts, listBills, listBudgets, listLots, listVault, spentByCategory } from "./extraStore";
import { AlertsPart, LotsPart } from "./ToolsMarket";
import { BillsPart, BudgetsPart, VaultPart } from "./ToolsMoney";

const TABS = [
  { id: "portfolio", label: "Portfolio" }, { id: "crypto", label: "Crypto" }, { id: "alerts", label: "Alerts" },
  { id: "budgets", label: "Budgets" }, { id: "bills", label: "Bills" }, { id: "vault", label: "Vault" },
];

export type ToolData = {
  alerts: Awaited<ReturnType<typeof listAlerts>>; lots: Awaited<ReturnType<typeof listLots>>;
  budgets: Awaited<ReturnType<typeof listBudgets>>; spent: Map<string, number>;
  bills: Awaited<ReturnType<typeof listBills>>; vault: Awaited<ReturnType<typeof listVault>>;
};
export type PartProps = { data: ToolData; watch: ModuleRow[]; busy: boolean; act: (skill: string, args?: Record<string, unknown>) => Promise<void> };

const empty: ToolData = { alerts: [], lots: [], budgets: [], spent: new Map(), bills: [], vault: [] };

export function Tools({ watch, busy, run }: { watch: ModuleRow[]; busy: boolean; run: ModuleState["run"] }) {
  const [tab, setTab] = useState("portfolio");
  const [data, setData] = useState<ToolData>(empty);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const month = new Date().toISOString().slice(0, 7);
    void Promise.all([listAlerts(), listLots(), listBudgets(), spentByCategory(month), listBills(), listVault()])
      .then(([alerts, lots, budgets, spent, bills, vault]) => setData({ alerts, lots, budgets, spent, bills, vault }))
      .catch(() => {});
  }, [tick, watch]);
  const act = async (skill: string, args?: Record<string, unknown>) => { await run(skill, args); setTick((t) => t + 1); };
  const p: PartProps = { data, watch, busy, act };
  return (
    <div className="fin-tools">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "portfolio" && <LotsPart {...p} watch={watch.filter((w) => w.asset !== "crypto")} />}
      {tab === "crypto" && <LotsPart {...p} watch={watch.filter((w) => w.asset === "crypto")} />}
      {tab === "alerts" && <AlertsPart {...p} />}
      {tab === "budgets" && <BudgetsPart {...p} />}
      {tab === "bills" && <BillsPart {...p} />}
      {tab === "vault" && <VaultPart {...p} />}
    </div>
  );
}
