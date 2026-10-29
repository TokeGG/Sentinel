// Data table: sticky header, mono cells, empty message spanning all columns.
export function Table({
  columns,
  rows,
  empty = "Nothing here yet.",
  className,
}: {
  columns: { key: string; label: string; width?: string; cellClass?: (row: Record<string, unknown>) => string | undefined }[];
  rows: Record<string, unknown>[];
  empty?: string;
  className?: string;
}) {
  const cell = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div className={`kit-table-wrap ${className ?? ""}`.trim()}>
      <table className="kit-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id != null ? String(r.id) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.cellClass?.(r)}>{cell(r[c.key])}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="kit-table-empty" colSpan={Math.max(1, columns.length)}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
