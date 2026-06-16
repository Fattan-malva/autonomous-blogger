import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';

let redis: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    logger.warn('Redis connection error, caching disabled', { error: err.message });
    redis = null;
  });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec = 3600): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSec, JSON.stringify(value));
  } catch {}
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

export function cacheKey(prefix: string, ...parts: string[]): string {
  return `research:${prefix}:${parts.join(':')}`;
}
