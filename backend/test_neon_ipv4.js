import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "./src/config/env.js";
import { users } from "./src/db/schema.js";

// Strip -pooler as required by neon-http
const httpUrl = env.DATABASE_URL.replace("-pooler", "");
const sql = neon(httpUrl);
const db = drizzle(sql);

async function run() {
  try {
    const res = await db.select().from(users).limit(1);
    console.log("Success with neon-http (IPv4):", res.length);
  } catch (err) {
    console.error("DB Error:", err);
  }
}
run();
