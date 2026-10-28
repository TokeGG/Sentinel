import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

// One shared handle; migrations already ran in src-tauri/src/lib.rs on startup.
export async function getDb(): Promise<Database> {
  if (!db) db = await Database.load("sqlite:sentinel.db");
  return db;
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
