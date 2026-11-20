import * as schema from "./schema";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { mkdirSync } from "node:fs";

/**
 * With DATABASE_URL set (Neon / any Postgres via Vercel Marketplace) we use it.
 * Without it we fall back to an embedded Postgres (PGlite) stored in .data/ so that
 * `npm run dev` works with zero setup.
 */
function createDb() {
  if (process.env.DATABASE_URL) {
    return drizzleNeon(neon(process.env.DATABASE_URL), { schema });
  }
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  mkdirSync(dir, { recursive: true });
  return drizzlePglite(new PGlite(dir), { schema });
}

type Db = ReturnType<typeof createDb>;
const g = globalThis as unknown as { __db?: Db };
export const db: Db = (g.__db ??= createDb());
export { schema };
