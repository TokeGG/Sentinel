// Rendered inside a child webview loaded at index.html#/panel/<id>. Wraps the
// module body (custom `ui` or the generic ModulePanel) in a PanelShell styled
// by the active saved view, provides PanelContext (view + status reporter),
// and toggles the customize drawer when this panel's chrome gear fires.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { ModulePanel } from "../core/ModulePanel";
import { registry, type ModuleManifest } from "../core/module";
import { EmptyState, ErrorLine, PanelShell, StatusLine } from "../ui/kit";
import { CustomizeDrawer } from "../ui/CustomizeDrawer";
import { PanelContext, useCustomize } from "../ui/useCustomize";
import type { PanelStatus } from "../ui/Section";
import { errorText } from "../ui/moduleRun";
import { PANEL_CUSTOMIZE, panelLabel } from "./panelEvents";
import { MASTER_ID, SETTINGS_ID } from "./panelApi";
import { MasterHub } from "./MasterHub";
import { SettingsPanel } from "./SettingsPanel";
import { BRIEFING_ID, CAPTURE_ID, HELP_ID, PALETTE_ID } from "./desk/ids";
import { Palette } from "./desk/Palette";
import { Briefing } from "./desk/Briefing";
import { HelpPanel } from "./desk/HelpPanel";
import { CaptureBox } from "./desk/CaptureBox";
import { useAppKeys } from "./desk/useAppKeys";

const SPECIAL: Record<string, ComponentType> = {
  [SETTINGS_ID]: SettingsPanel, [MASTER_ID]: MasterHub, [PALETTE_ID]: Palette,
  [BRIEFING_ID]: Briefing, [HELP_ID]: HelpPanel, [CAPTURE_ID]: CaptureBox,
};

export function panelIdFromHash(hash: string): string | null {
  return hash.startsWith("#/panel/") ? decodeURIComponent(hash.slice("#/panel/".length)) : null;
}

type Body = ComponentType<{ module: ModuleManifest }>;
const bodies = new WeakMap<ModuleManifest, Body>();
// One lazy component per manifest; a failed import renders an error, not a crash.
function customBody(m: ModuleManifest): Body {
  let b = bodies.get(m);
  if (!b) {
    const load = m.ui!;
    b = lazy(() =>
      load().catch((e) => ({ default: () => <ErrorLine message={`Panel failed to load: ${errorText(e)}`} /> }))
    );
    bodies.set(m, b);
  }
  return b;
}

export function PanelRoute({ id }: { id: string }) {
  useAppKeys(); // Ctrl+K etc. work inside panels too (forwarded to the main window)
  const Special = SPECIAL[id];
  if (Special) {
    return (
      <PanelShell className="panel-route">
        <Special />
      </PanelShell>
    );
  }
  const m = registry.find((x) => x.id === id);
  if (!m) {
    return (
      <PanelShell className="panel-route">
        <EmptyState title="Module not found" hint={id} />
      </PanelShell>
    );
  }
  return <PanelBody key={m.id} m={m} />;
}

function useCustomizeEvent(id: string, onToggle: () => void) {
  useEffect(() => {
    // Target = this webview's label so Rust only delivers our own gear's
    // emitTo; the payload id is checked too.
    const un = listen<{ id?: unknown }>(
      PANEL_CUSTOMIZE,
      ({ payload }) => payload?.id === id && onToggle(),
      { target: panelLabel(id) }
    );
    return () => void un.then((f) => f()).catch(() => {});
  }, [id, onToggle]);
}

function PanelBody({ m }: { m: ModuleManifest }) {
  const cz = useCustomize(m);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PanelStatus>({ updated: null, error: null });
  const toggle = useCallback(() => setOpen((o) => !o), []);
  useCustomizeEvent(m.id, toggle);
  // The gear lives in another webview; take keyboard focus so Esc/Tab work.
  useEffect(() => {
    if (!open) return;
    try {
      getCurrentWebview().setFocus().catch(() => {});
    } catch {
      /* not inside Tauri (e.g. a plain browser) */
    }
  }, [open]);

  const ctx = useMemo(() => ({ view: cz.view, onStatus: setStatus }), [cz.view]);
  const Custom = m.panel === "custom" && m.ui ? customBody(m) : null;
  const auto = cz.view.refreshMinutes ? `${cz.view.refreshMinutes} min` : null;
  return (
    <PanelShell className="panel-route" vars={cz.vars}>
      <PanelContext.Provider value={ctx}>
        {cz.error && <ErrorLine message={`Customize: ${cz.error}`} />}
        {!cz.ready ? (
          <EmptyState title="Loading…" />
        ) : Custom ? (
          <Suspense fallback={<EmptyState title="Loading…" />}>
            <Custom module={m} />
          </Suspense>
        ) : (
          <ModulePanel module={m} />
        )}
        <StatusLine updated={status.updated} autoRefresh={auto} error={status.error} />
        {open && <CustomizeDrawer module={m} cz={cz} onClose={() => setOpen(false)} />}
      </PanelContext.Provider>
    </PanelShell>
  );
}
