// Pure: holidays -> agenda rows (all-day, `holiday: true` so views draw them distinctly).
import { holidayTitle, type Holiday } from "./holidays.ts";
import { localToIso } from "./ownRows.ts";

export const holidayRows = (hs: Holiday[]): Record<string, unknown>[] =>
  hs.map((h) => ({
    id: `hol-${h.set}-${h.key}`, title: holidayTitle(h), text: holidayTitle(h), kind: "holiday", holiday: true, allDay: true,
    source: h.set.startsWith("nager:") ? `Holiday ${h.set.slice(6)}` : "Holiday", due: localToIso(h.day), notes: h.approx ? "Approximate date; edit it in Holidays." : "",
  }));
