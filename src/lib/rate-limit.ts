// Minimal in-memory sliding-window rate limiter for API routes. Suitable for a
// single-instance / demo deployment. For serverless scale, swap for a shared
// store (e.g. Redis or Supabase) behind the same interface.

const WINDOW_MS = 60_000;

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit = 15, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Best-effort IP extraction from request headers. */
export function clientKey(req: Request, suffix = ""): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "local";
  return `${ip}${suffix}`;
}
