import { registerModule, type ModuleManifest } from "../../core/module";
import { extraSkills, unseenAlerts } from "./extraStore";
import { financeSections } from "./panelLogic";
import { refreshQuotes } from "./quotes";
import { addSymbol, loadRows, removeSymbol } from "./store";
import { syncCongressTrades } from "./trades";

export const financeModule: ModuleManifest = {
  id: "hub.finance",
  name: "Finance",
  accent: "#d4c021",
  ring: "daily",
  category: "finance",
  icon: "finance",
  description:
    "Stock/ETF (Stooq) and crypto (CoinGecko) watchlist, plus Senate/House trade disclosures. All free, no key, no account linking.",
  panel: "custom",
  ui: () => import("./Panel"),
  customize: { sections: financeSections },
  skills: [
    { name: "add_symbol", run: addSymbol },
    { name: "refresh_quotes", run: refreshQuotes },
    { name: "remove_symbol", run: removeSymbol },
    { name: "sync_congress_trades", run: syncCongressTrades },
    ...extraSkills,
  ],
  load: loadRows,
  // Price alerts that fired since you last looked (counts only).
  badge: unseenAlerts,
  quickAdd: {
    skill: "add_symbol",
    argName: "symbol",
    placeholder: 'Add a symbol (e.g. "AAPL" or "bitcoin:crypto")…',
  },
  actions: [
    { label: "Refresh quotes", skill: "refresh_quotes" },
    { label: "Sync Congress Trades", skill: "sync_congress_trades" },
  ],
  schedule: { skill: "refresh_quotes", intervalMinutes: 60 },
};

registerModule(financeModule);
