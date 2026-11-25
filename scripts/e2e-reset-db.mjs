// Fresh, migrated SQLite file for end-to-end tests. Refuses anything but a local file under the project.
import { rmSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL ?? "";
if (!/^file:e2e[\w-]*\.db$/.test(url)) {
  console.error(`e2e-reset-db: refusing to reset ${url || "(unset)"}; expected file:e2e*.db`);
  process.exit(1);
}
const file = url.slice("file:".length);
for (const f of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
await migrate(drizzle(createClient({ url })), { migrationsFolder: "db/migrations" });
console.log(`e2e-reset-db: ${file} ready`);
