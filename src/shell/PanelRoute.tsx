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
import { AssistBar } from "../ui/AssistBar";
import { ChangedBanner } from "../ui/ChangedBanner";
import { useModSettings } from "../ui/useModSettings";
import { PanelContext, useCustomize } from "../ui/useCustomize";
import type { PanelStatus } from "../ui/Section";
import { errorText } from "../ui/moduleRun";
import { PANEL_CUSTOMIZE, panelLabel } from "./panelEvents";
import { MASTER_ID, SETTINGS_ID, YTPLAYER_ID } from "./panelApi";
import { MasterHub } from "./MasterHub";
import { SettingsPanel } from "./SettingsPanel";
import { BRIEFING_ID, CAPTURE_ID, HELP_ID, PALETTE_ID, SNAP_ID } from "./desk/ids";
import { SnapLayouts } from "./snap/SnapLayouts";
import { Palette } from "./desk/Palette";
import { Briefing } from "./desk/Briefing";
import { HelpPanel } from "./desk/HelpPanel";
import { CaptureBox } from "./desk/CaptureBox";
import { useAppKeys } from "./desk/useAppKeys";
import { useThemeSync } from "./desk/themeApply";
import { usePanelView } from "./desk/usePanelView";
import { useSnippetExpand } from "./extras/useSnippetExpand";
import { viewStyle } from "./desk/panelView";
import { useTimeTrack } from "./useTimeTrack";

const YtPlayer = lazy(() => import("../modules/youtube/PopPlayer"));
const PopPlayer = () => <Suspense fallback={null}><YtPlayer /></Suspense>;
const SPECIAL: Record<string, ComponentType> = {
  [YTPLAYER_ID]: PopPlayer,
  [SETTINGS_ID]: SettingsPanel, [MASTER_ID]: MasterHub, [PALETTE_ID]: Palette,
  [BRIEFING_ID]: Briefing, [HELP_ID]: HelpPanel, [CAPTURE_ID]: CaptureBox, [SNAP_ID]: SnapLayouts,
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
  useSnippetExpand(); // opt-in ;trigger -> snippet body
  useThemeSync();
  useAppKeys(); // Ctrl+K etc. work inside panels too (forwarded to the main window)
  useTimeTrack(id);
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
  const pv = usePanelView(m.id); // zoom/opacity/scroll per module (Settings > Panels)
  const ms = useModSettings(m.id); // generic per-module settings: Ask bar, link mode
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
        <div style={viewStyle(pv)}>
        {cz.error && <ErrorLine message={`Customize: ${cz.error}`} />}
        <ChangedBanner m={m} />
        {!cz.ready ? (
          <EmptyState title="Loading…" />
        ) : Custom ? (
          <Suspense fallback={<EmptyState title="Loading…" />}>
            <Custom module={m} />
          </Suspense>
        ) : (
          <ModulePanel module={m} />
        )}
        </div>
        {ms.assist && cz.ready && m.panel !== "web" && <AssistBar module={m} />}
        <StatusLine updated={status.updated} autoRefresh={auto} error={status.error} />
        {open && <CustomizeDrawer module={m} cz={cz} onClose={() => setOpen(false)} />}
      </PanelContext.Provider>
    </PanelShell>
  );
}
