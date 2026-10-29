import { openLink as openUrl } from "../../ui/openLink"; // in-app browser or system (links_open_in)
import pkg from "../../../package.json";
import { Row } from "../../ui/kit";
import { safeLink } from "../../ui/safeLink";
import { Head } from "./Switch";

const RELEASES = safeLink("https://github.com/TokeGG/Sentinel/releases");

export function AboutSection({ onError }: { onError(e: unknown): void }) {
  return (
    <section className="st-section" aria-label="About">
      <Head>About</Head>
      <Row end={<span>{pkg.version}</span>}>Version</Row>
      <Row><button type="button" className="ui-link" disabled={!RELEASES}
        onClick={() => RELEASES && openUrl(RELEASES).catch(onError)}>Releases on GitHub</button></Row>
      <p className="ui-meta">Sentinel runs locally: no cloud AI, secrets stay in your OS keychain.</p>
    </section>
  );
}
