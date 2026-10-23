import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(url: string, authToken?: string): Db {
  return drizzle(createClient({ url, authToken }), { schema });
}

let db: Db | undefined;

/**
 * Server-only. Created lazily so process.env is read at request time (OpenNext fills it per request on Workers).
 * @libsql/client resolves to its web build on Workers via the "workerd" export condition.
 */
export function getDb(): Db {
  db ??= createDb(process.env.TURSO_DATABASE_URL ?? "file:local.db", process.env.TURSO_AUTH_TOKEN);
  return db;
}
