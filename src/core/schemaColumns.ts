// Pure: column-level guard for ensureSchema. CREATE TABLE IF NOT EXISTS never
// changes a table that already exists, so a table made by an older/dev copy of
// a migration can lack columns. These helpers turn the bootstrap statement into
// guarded ALTER TABLE ADD COLUMN statements for columns missing per
// pragma_table_info. SQLite cannot add PRIMARY KEY/UNIQUE columns (skipped) nor
// a NOT NULL column without a constant default (added nullable instead).

export const tableOf = (sql: string) => /CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/i.exec(sql)?.[1] ?? "";

function splitTop(body: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface ColumnDef { name: string; def: string }

export function columnsOf(sql: string): ColumnDef[] {
  const open = sql.indexOf("("), close = sql.lastIndexOf(")");
  if (open < 0 || close < open) return [];
  return splitTop(sql.slice(open + 1, close))
    .filter((p) => !/^(PRIMARY\s+KEY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)\b/i.test(p))
    .map((p) => ({ name: p.split(/\s+/)[0].replace(/["`]/g, ""), def: p }));
}

function addable(def: string): string | null {
  if (/\b(PRIMARY\s+KEY|UNIQUE)\b/i.test(def)) return null;
  const nonConst = /DEFAULT\s*\(/i.test(def);
  if (nonConst) return def.replace(/\s+NOT\s+NULL/i, "").replace(/\s+DEFAULT\s*\(.*\)\s*$/i, "");
  if (/NOT\s+NULL/i.test(def) && !/DEFAULT/i.test(def)) return def.replace(/\s+NOT\s+NULL/i, "");
  return def;
}

/** ALTER statements for columns of `createSql` missing from `existing` (lower-cased compare). */
export function addColumnSql(createSql: string, existing: string[]): string[] {
  if (!existing.length) return []; // table absent or unreadable: CREATE handles it
  const have = new Set(existing.map((c) => c.toLowerCase()));
  const table = tableOf(createSql);
  return columnsOf(createSql)
    .filter((c) => !have.has(c.name.toLowerCase()))
    .map((c) => addable(c.def))
    .filter((d): d is string => !!d)
    .map((d) => `ALTER TABLE ${table} ADD COLUMN ${d}`);
}
