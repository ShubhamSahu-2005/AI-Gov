import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env.js";
import * as schema from "../db/schema.js";

// Parse DATABASE_URL for explicit config to avoid sslmode parsing issues
const dbUrl = new URL(env.DATABASE_URL);

export const pool = new pg.Pool({
  host: dbUrl.hostname.replace("-pooler", ""),
  port: dbUrl.port || 5432,
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: dbUrl.password,
  ssl: { rejectUnauthorized: false }, // Avoids verify-full strict mode issues
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // 20 seconds to allow Neon to wake up
});

export const db = drizzle(pool, { schema });
