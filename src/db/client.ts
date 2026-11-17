import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

type AppDatabase = PostgresJsDatabase<typeof schema>;

declare global {
  var __zaojingPostgresClient: Sql | undefined;
  var __zaojingDatabase: AppDatabase | undefined;
}

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("数据库尚未配置，请先设置 DATABASE_URL 并执行数据库迁移");
    this.name = "DatabaseConfigurationError";
  }
}

export function getDatabase(): AppDatabase {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new DatabaseConfigurationError();

  if (!globalThis.__zaojingPostgresClient) {
    globalThis.__zaojingPostgresClient = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  if (!globalThis.__zaojingDatabase) {
    globalThis.__zaojingDatabase = drizzle(globalThis.__zaojingPostgresClient, { schema });
  }
  return globalThis.__zaojingDatabase;
}
