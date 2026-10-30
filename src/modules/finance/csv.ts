// Pure portfolio CSV: export lots, parse an import into a preview (nothing is written until Apply).
export type CsvLot = { symbol: string; kind: "stock" | "crypto"; qty: number; cost: number; bought_on: string };
export const CSV_HEADER = "symbol,kind,qty,cost,bought_on";

const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function toCsv(rows: CsvLot[]): string {
  return [CSV_HEADER, ...rows.map((r) => [r.symbol, r.kind, r.qty, r.cost, r.bought_on].map(cell).join(","))].join("\n");
}

/** One CSV line -> cells (quotes and "" escapes). */
export function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export type CsvPreview = { rows: CsvLot[]; errors: string[] };

/** Parses CSV text (header optional, columns as CSV_HEADER); bad lines are listed, not imported. */
export function parseCsv(text: string): CsvPreview {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines[0] && /symbol/i.test(lines[0])) lines.shift();
  const rows: CsvLot[] = [], errors: string[] = [];
  lines.slice(0, 2000).forEach((l, i) => {
    const [symbol, kind, qty, cost, day] = splitLine(l);
    const k = (kind || "stock").toLowerCase();
    const q = Number(qty), c = Number(cost);
    if (!symbol || !/^[\w.-]{1,40}$/.test(symbol)) return void errors.push(`line ${i + 1}: bad symbol`);
    if (k !== "stock" && k !== "crypto") return void errors.push(`line ${i + 1}: kind must be stock or crypto`);
    if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(c) || c < 0) return void errors.push(`line ${i + 1}: qty/cost must be numbers`);
    const d = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
    rows.push({ symbol: symbol.toLowerCase(), kind: k, qty: q, cost: c, bought_on: d });
  });
  return { rows, errors };
}
