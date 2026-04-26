import { db } from "./src/config/db.js";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("Keys:", Object.keys(result));
    if (result.rows) {
      console.log("Rows:", result.rows);
    } else {
      console.log("Result:", result);
    }
  } catch (err) {
    console.error(err);
  }
}
run();
