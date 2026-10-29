import Database from "@tauri-apps/plugin-sql";

let loading: Promise<Database> | null = null;

// tauri-plugin-sql runs the migrations only inside the FIRST `load` call; an
// overlapping second load returns at once, before the new tables exist. So
// every caller shares one load promise (cleared on failure so it can retry).
export function getDb(): Promise<Database> {
  loading ??= Database.load("sqlite:sentinel.db").catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

// The shared activity log every module writes to (Core Architecture: "what
// did it do" is always answerable from one place).
export async function logActivity(
  module: string,
  skill: string,
  summary: string,
  result: string
) {
  const d = await getDb();
  await d.execute(
    "INSERT INTO activity_log (module, skill, summary, result) VALUES ($1, $2, $3, $4)",
    [module, skill, summary, result]
  );
}
