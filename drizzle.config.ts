import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Drizzle Kit needs a URL while loading config. Runtime code still refuses
    // to connect until a real DATABASE_URL is configured.
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/zaojing",
  },
  strict: true,
  verbose: true,
});
