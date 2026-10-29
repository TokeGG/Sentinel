// The Settings panel (id hub.settings). Not a module: it is rendered by
// PanelRoute directly and opened by the HUD's ⚙ Settings button.
import { useCallback, useState } from "react";
import { ErrorLine } from "../ui/kit";
import { errorText } from "../ui/moduleRun";
import { AboutSection } from "./settings/AboutSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { DiagnosticsSection } from "./settings/DiagnosticsSection";
import { DataSection } from "./settings/DataSection";
import { GeneralSection } from "./settings/GeneralSection";
import { JobsSection } from "./settings/JobsSection";
import "./settings/settings.css";

export function SettingsPanel() {
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((e: unknown) => setError(errorText(e)), []);
  return (
    <div className="st-sections">
      {error && <ErrorLine message={error} onDismiss={() => setError(null)} />}
      <GeneralSection onError={onError} />
      <AppearanceSection onError={onError} />
      <JobsSection onError={onError} />
      <DataSection onError={onError} />
      <DiagnosticsSection onError={onError} />
      <AboutSection onError={onError} />
    </div>
  );
}
