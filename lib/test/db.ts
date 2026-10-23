import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb, type Db } from "@/db";

/** Fresh migrated SQLite file per test (in-memory DBs do not survive libsql transactions). */
export async function createTestDb(): Promise<{ db: Db; cleanup: () => void }> {
  const dir = mkdtempSync(path.join(tmpdir(), "cangku-test-"));
  const db = createDb(`file:${path.join(dir, "test.db")}`);
  await migrate(db, { migrationsFolder: "db/migrations" });
  return { db, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
