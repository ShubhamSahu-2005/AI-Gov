import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  PINATA_API_KEY: z.string().optional(),
  PINATA_SECRET: z.string().optional(),
  ALCHEMY_SEPOLIA_URL: z.string().optional(),
  DAO_TOKEN_ADDRESS: z.string().optional(),
  DAO_GOVERNANCE_ADDRESS: z.string().optional(),
  DAO_TREASURY_ADDRESS: z.string().optional(),
  ETHERSCAN_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().optional().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  parsed.error.errors.forEach((e) => {
    console.error(`   ${e.path.join(".")}: ${e.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
