// Pure CSV import: header-optional rows of title,date,time,notes -> add_item args + per-line errors.
const DAY = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Splits one CSV line (double-quoted fields, "" = quote). */
export function csvCells(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface CsvRow { title: string; day: string; time: string; notes: string }

export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const rows: CsvRow[] = [], errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const [title = "", day = "", time = "", notes = ""] = csvCells(line);
    if (i === 0 && /^title$/i.test(title)) return;
    if (!title) return void errors.push(`line ${i + 1}: no title`);
    if (!DAY.test(day)) return void errors.push(`line ${i + 1}: date "${day}" is not YYYY-MM-DD`);
    if (time && !TIME.test(time)) return void errors.push(`line ${i + 1}: time "${time}" is not HH:MM`);
    rows.push({ title, day, time: time ? time.padStart(5, "0") : "", notes });
  });
  return { rows, errors };
}
