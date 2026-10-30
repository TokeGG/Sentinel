// Settings > Desktop: read-aloud voice and speed for the briefing (OS voices only, no network).
import { useEffect, useState } from "react";
import { Row } from "../../ui/kit";
import { getSetting, setSetting } from "../../ui/appSetting";

export function VoiceRows({ onError }: { onError(e: unknown): void }) {
  const [voices, setVoices] = useState<string[]>([]);
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState("1");
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const list = () => setVoices(speechSynthesis.getVoices().map((v) => v.name));
    list();
    speechSynthesis.addEventListener("voiceschanged", list);
    getSetting("brief_voice").then((v) => setVoice(v ?? "")).catch(onError);
    getSetting("brief_voice_rate").then((v) => setRate(v || "1")).catch(onError);
    return () => speechSynthesis.removeEventListener("voiceschanged", list);
  }, []);
  if (!("speechSynthesis" in window)) return null;
  const save = (k: string, v: string, set: (s: string) => void) => setSetting(k, v).then(() => set(v)).catch(onError);
  return (
    <>
      <Row><label className="st-switch">Briefing voice
        <select id="brief-voice" value={voice} onChange={(e) => save("brief_voice", e.target.value, setVoice)}><option value="">System default</option>{voices.map((v) => <option key={v}>{v}</option>)}</select></label></Row>
      <Row><label className="st-switch">Briefing speech speed
        <select id="brief-rate" value={rate} onChange={(e) => save("brief_voice_rate", e.target.value, setRate)}>{["0.8", "1", "1.2", "1.5"].map((r) => <option key={r} value={r}>{r}x</option>)}</select></label></Row>
    </>
  );
}
