import { env } from "cloudflare:workers";

type Db = {
  prepare(query: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }>; run(): Promise<unknown>; first<T>(): Promise<T | null> } };
  exec(query: string): Promise<unknown>;
};

export function sheetsDb(): Db {
  const db = (env as unknown as { DB?: Db }).DB;
  if (!db) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return db;
}

let ready = false;
export async function ensureSheetsTable(db: Db) {
  if (ready) return;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS sheet_images (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, project_id TEXT NOT NULL, page_number INTEGER NOT NULL, label TEXT NOT NULL DEFAULT '', width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_sheet_images_project ON sheet_images (project_id, event_id, page_number)");
  ready = true;
}

