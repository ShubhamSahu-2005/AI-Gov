import { db, pool } from "./src/config/db.js";
import { proposals } from "./src/db/schema.js";
import { desc } from "drizzle-orm";

async function run() {
  try {
    const res = await db.select().from(proposals).orderBy(desc(proposals.createdAt));
    console.log("Success:", res.length);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}
run();
