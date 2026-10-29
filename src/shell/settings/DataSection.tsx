import { useEffect, useState } from "react";
import { appDataDir } from "@tauri-apps/api/path";
import { registry } from "../../core/module";
import { Row } from "../../ui/kit";
import { openPanel } from "../panelApi";
import { Head } from "./Switch";

export function DataSection({ onError }: { onError(e: unknown): void }) {
  const [dir, setDir] = useState<string | null>(null);
  useEffect(() => {
    appDataDir().then(setDir).catch(() => setDir(null)); // folder line is optional
  }, []);
  const backup = registry.find((m) => m.id === "hub.backup");
  return (
    <section className="st-section" aria-label="Data">
      <Head>Data</Head>
      <Row end={<button type="button" className="ui-btn" disabled={!backup}
        onClick={() => backup && openPanel(backup).catch(onError)}>Open Backup &amp; Snapshot</button>}>
        Back up or restore your Sentinel data
      </Row>
      {dir && <Row><span className="ui-meta">Data folder:</span> <code className="st-path">{dir}</code></Row>}
    </section>
  );
}
