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
import { ExportSection } from "./settings/ExportSection";
import { GeneralSection } from "./settings/GeneralSection";
import { NotificationsSection } from "./settings/NotificationsSection";
import { JobsSection } from "./settings/JobsSection";
import { UpdatesSection } from "./settings/UpdatesSection";
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
      <JobsSection onError={onError} />
      <DesktopSection onError={onError} />
      <SnapSection onError={onError} />
      <DataSection onError={onError} />
      <ExportSection onError={onError} />
      <DiagnosticsSection onError={onError} />
      <UpdatesSection onError={onError} />
      <AboutSection onError={onError} />
    </div>
  );
}
