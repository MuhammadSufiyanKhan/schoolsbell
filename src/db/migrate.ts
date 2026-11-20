import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { db } from "./index";

export async function runMigrations() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  if (process.env.DATABASE_URL) await migrateNeon(d, { migrationsFolder: "./drizzle" });
  else await migratePglite(d, { migrationsFolder: "./drizzle" });
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations().then(() => {
    console.log("✓ migrations applied");
    process.exit(0);
  });
}
