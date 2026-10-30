// Settings > Productivity: calendar time zones, recurring task templates
// (Add now = calendar add_item), snippet expansion toggle.
import { useState } from "react";
import { registry } from "../../core/module";
import { Row } from "../../ui/kit";
import { cleanTemplates, cleanZones, templateItem, validZone, type Repeat } from "../../modules/calendar/timeExtras";
import { Head, Switch } from "./Switch";
import { useJsonSetting, useTextSetting } from "./useJsonSetting";

export function ProductivitySection({ onError }: { onError(e: unknown): void }) {
  const [zones, setZones] = useJsonSetting("cal_zones", cleanZones, onError);
  const [tpls, setTpls] = useJsonSetting("task_templates", cleanTemplates, onError);
  const [expand, setExpand] = useTextSetting("snippet_expand", onError);
  const [zone, setZone] = useState("");
  const [t, setT] = useState({ name: "", title: "", repeat: "weekly" as Repeat });
  const addNow = async (i: number) => {
    const cal = registry.find((m) => m.id === "hub.calendar");
    const sk = cal?.skills.find((s) => s.name === "add_item");
    if (!sk) throw new Error("Calendar module is not available");
    await sk.run(templateItem(tpls[i], new Date()));
  };
  return (
    <section className="st-section" aria-label="Productivity">
      <Head>Productivity</Head>
      <Row><Switch checked={expand === "1"} onChange={(on) => setExpand(on ? "1" : "0")}>Snippet expansion (type ;name in any panel text field)</Switch></Row>
      <h3 className="ui-meta">Calendar time zones (shown side by side in Today)</h3>
      {zones.map((z) => <Row key={z} end={<button type="button" className="ui-btn ui-sm" onClick={() => setZones(zones.filter((x) => x !== z))}>Remove</button>}>{z}</Row>)}
      <Row end={<button type="button" className="ui-btn" disabled={!validZone(zone.trim()) || !zone.trim()} onClick={() => { setZones([...zones, zone.trim()]); setZone(""); }}>Add zone</button>}>
        <input className="st-input" placeholder="Europe/London" value={zone} onChange={(e) => setZone(e.target.value)} /></Row>
      <h3 className="ui-meta">Recurring task templates</h3>
      {tpls.map((x, i) => (
        <Row key={x.name + i} end={<>
          <button type="button" className="ui-btn ui-sm" onClick={() => addNow(i).catch(onError)}>Add task now</button>
          <button type="button" className="ui-btn ui-sm" onClick={() => setTpls(tpls.filter((_, j) => j !== i))}>Remove</button></>}>
          <strong>{x.name}</strong> <span className="ui-meta">{x.title} · {x.repeat}</span></Row>
      ))}
      <Row end={<button type="button" className="ui-btn" disabled={!t.name.trim() || !t.title.trim()} onClick={() => { setTpls([...tpls, t]); setT({ ...t, name: "", title: "" }); }}>Add template</button>}>
        <input className="st-input" placeholder="name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        <input className="st-input" placeholder="task title" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
        <select value={t.repeat} onChange={(e) => setT({ ...t, repeat: e.target.value as Repeat })}><option>daily</option><option>weekly</option><option>monthly</option></select>
      </Row>
    </section>
  );
}
