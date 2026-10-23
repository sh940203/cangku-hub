// Connectivity check: lists tables in the configured database.
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const res = await client.execute(
  "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '\\_\\_%' escape '\\' order by name",
);
console.log(`connected: ${url.startsWith("file:") ? url : new URL(url).host}`);
console.log(res.rows.map((r) => r.name).join("\n"));
