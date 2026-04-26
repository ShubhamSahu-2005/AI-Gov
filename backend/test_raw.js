import pg from "pg";
import { env } from "./src/config/env.js";

const dbUrl = new URL(env.DATABASE_URL);
const pool = new pg.Pool({
  host: dbUrl.hostname.replace("-pooler", ""),
  port: dbUrl.port || 5432,
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: dbUrl.password,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    const res = await pool.query("SELECT 1 as test");
    console.log("Success:", res.rows);
  } catch (err) {
    console.error("RAW PG ERROR:", err);
  } finally {
    pool.end();
  }
}
run();
