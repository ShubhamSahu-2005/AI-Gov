import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { env } from "./src/config/env.js";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: env.DATABASE_URL.replace("-pooler", ""),
});

async function run() {
  try {
    const res = await pool.query("SELECT 1 as test");
    console.log("Success:", res.rows);
  } catch (err) {
    console.error("RAW WS ERROR:", err);
  } finally {
    pool.end();
  }
}
run();
