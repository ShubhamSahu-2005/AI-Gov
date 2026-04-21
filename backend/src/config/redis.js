import Redis from "ioredis";
import { env } from "./env.js";

let redis = null;

try {
  const isUpstash = env.REDIS_URL.startsWith("rediss://");

  redis = new Redis(env.REDIS_URL, {
    ...(isUpstash && { tls: { rejectUnauthorized: false } }),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 100, 500);
    },
  });

  redis.on("error", (err) => {
    // Suppress repeated connection errors in dev — caching is optional
    if (env.NODE_ENV === "development") {
      console.warn("⚠️  Redis unavailable (caching disabled):", err.message);
    }
  });

  redis.on("connect", () => {
    console.log("✅ Redis connected:", env.REDIS_URL.split("@").pop() || env.REDIS_URL);
  });

  // Try connecting — if it fails, caching just won't work
  await redis.connect().catch(() => {
    console.warn("⚠️  Redis not reachable — all requests will skip cache");
  });
} catch (err) {
  console.warn("⚠️  Redis init failed (caching disabled):", err.message);
  redis = null;
}

export { redis };
