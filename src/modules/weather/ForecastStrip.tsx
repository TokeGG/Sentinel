// One place's 5-day forecast (Open-Meteo daily) as a row of small day cards.
import { conditionGlyph, conditionText, placeName, tempText, type Units } from "./panelLogic";
import { dayName, type Day } from "./forecast";

export function ForecastStrip({ row, units }: { row: Record<string, unknown>; units: Units }) {
  const days = Array.isArray(row.forecast) ? (row.forecast as Day[]) : [];
  if (!days.length) return null;
  return (
    <div className="wx-fc" aria-label={`${placeName(row)} forecast`}>
      <h4 className="wx-fcname">{placeName(row)}</h4>
      {days.map((d, i) => (
        <div key={d.day} className="wx-fcday" title={conditionText(d.code)}>
          <span className="ui-meta">{dayName(d.day, i)}</span>
          <span aria-hidden="true">{conditionGlyph(d.code)}</span>
          <span>{tempText(d.hi, units)}</span>
          <span className="ui-meta">{tempText(d.lo, units)}</span>
        </div>
      ))}
    </div>
  );
}
