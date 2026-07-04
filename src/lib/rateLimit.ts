// Small in-memory rate limiter for the login endpoint (brute-force guard).
// Serverless note: on Vercel each warm instance keeps its own counters, so the
// effective ceiling is (limit × instances) — still a strong brake on password
// guessing, with zero infrastructure. Counters reset when the window expires.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000; // hard memory cap; oldest are dropped

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      const first = buckets.keys().next().value;
      if (first !== undefined) buckets.delete(first);
    }
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}

// Clear an identity's counter after a successful login, so a legitimate user
// who fumbled their password a few times isn't still throttled.
export function rateLimitReset(key: string) {
  buckets.delete(key);
}
