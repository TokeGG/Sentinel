// The Settings panel (id hub.settings). Not a module: it is rendered by
// PanelRoute directly and opened by the HUD's ⚙ Settings button.
import { useCallback, useState } from "react";
import { ErrorLine } from "../ui/kit";
import { errorText } from "../ui/moduleRun";
import { AccountsSection } from "./settings/AccountsSection";
import { AboutSection } from "./settings/AboutSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { DiagnosticsSection } from "./settings/DiagnosticsSection";
import { DataSection } from "./settings/DataSection";
import { DesktopSection } from "./settings/DesktopSection";
import { SnapSection } from "./settings/SnapSection";
import { TerminalSection } from "./settings/TerminalSection";
import { DefaultsSection } from "./settings/DefaultsSection";
import { ExportSection } from "./settings/ExportSection";
import { GeneralSection } from "./settings/GeneralSection";
import { NotificationsSection } from "./settings/NotificationsSection";
import { JobsSection } from "./settings/JobsSection";
import { UpdatesSection } from "./settings/UpdatesSection";
import { ModulesSection } from "./settings/ModulesSection";
import { KnowledgeSection } from "./settings/KnowledgeSection";
import { DataSourcesSection } from "./settings/DataSourcesSection";
import { PanelsSection } from "./settings/PanelsSection";
import { AlertRulesSection } from "./settings/AlertRulesSection";
import { ProductivitySection } from "./settings/ProductivitySection";
import { ThemeBuilderSection } from "./settings/ThemeBuilderSection";
import { SystemSection } from "./settings/SystemSection";
import { PrivacySection } from "./settings/PrivacySection";
import { LockSection } from "./settings/LockSection";
import { DataMapSection } from "./settings/DataMapSection";
import { LogSection } from "./settings/LogSection";
import "./settings/settings.css";

export function SettingsPanel() {
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((e: unknown) => setError(errorText(e)), []);
  return (
    <div className="st-sections">
      {error && <ErrorLine message={error} onDismiss={() => setError(null)} />}
      <GeneralSection onError={onError} />
      <AppearanceSection onError={onError} />
      <AccountsSection onError={onError} />
      <NotificationsSection onError={onError} />
      <AlertRulesSection onError={onError} />
      <JobsSection onError={onError} />
      <ModulesSection onError={onError} />
      <KnowledgeSection onError={onError} />
      <DataSourcesSection onError={onError} />
      <DesktopSection onError={onError} />
      <ThemeBuilderSection onError={onError} />
      <PanelsSection onError={onError} />
      <ProductivitySection onError={onError} />
      <TerminalSection onError={onError} />
      <DefaultsSection onError={onError} />
      <SnapSection onError={onError} />
      <DataSection onError={onError} />
      <ExportSection onError={onError} />
      <DiagnosticsSection onError={onError} />
      <UpdatesSection onError={onError} />
      <AboutSection onError={onError} />
      <SystemSection onError={onError} />
      <PrivacySection onError={onError} />
      <LockSection onError={onError} />
      <DataMapSection onError={onError} />
      <LogSection onError={onError} />
    </div>
  );
}
