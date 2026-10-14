import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (add Neon integration, then `vercel env pull`).");
  process.exit(1);
}
const sql = neon(url);
const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
for (const statement of statements) await sql.query(statement);
const [{ count }] = await sql.query(
  "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
);
console.log(`migrated ${statements.length} statements; ${count} public tables`);
