import { db, pool } from "./src/config/db.js";
import { users } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  try {
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        db.select().from(users).where(eq(users.id, "45bbfb9a-c2ce-4b1a-81b0-2390ddbfdab5")).limit(1)
      );
    }
    await Promise.all(promises);
    console.log("All 20 queries succeeded");
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}
run();
