import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "./src/config/env.js";
import { users } from "./src/db/schema.js";

const sql = neon(env.DATABASE_URL);
const db = drizzle(sql);

async function run() {
  try {
    const res = await db.select().from(users).limit(1);
    console.log("Success with pooler:", res.length);
  } catch (err) {
    console.error("DB Error:", err);
  }
}
run();
