import { redis } from "../config/redis.js";

const DEFAULT_TTL = 60 * 5; // 5 minutes

export const cacheGet = async (key) => {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (key, value, ttl = DEFAULT_TTL) => {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch (err) {
    console.warn("Cache set failed:", err.message);
  }
};

export const cacheDelete = async (...keys) => {
  if (!redis) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn("Cache delete failed:", err.message);
  }
};

export const cacheDeletePattern = async (pattern) => {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    console.warn("Cache pattern delete failed:", err.message);
  }
};
