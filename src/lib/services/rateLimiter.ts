type RateLimitTier = "default" | "strict" | "auth";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const TIERS: Record<RateLimitTier, RateLimitConfig> = {
  default: { windowMs: 60_000, maxRequests: 60 },
  strict: { windowMs: 60_000, maxRequests: 10 },
  auth: { windowMs: 60_000, maxRequests: 5 },
};

const stores = new Map<string, Map<RateLimitTier, RateLimitEntry>>();

setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }
}, 60_000);

export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = "default"
): { allowed: boolean; remaining: number; resetAt: number } {
  const config = TIERS[tier];
  const now = Date.now();

  let store = stores.get(identifier);
  if (!store) {
    store = new Map();
    stores.set(identifier, store);
  }

  const entry = store.get(tier);

  if (!entry || entry.resetAt <= now) {
    store.set(tier, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  return { allowed: entry.count <= config.maxRequests, remaining, resetAt: entry.resetAt };
}
