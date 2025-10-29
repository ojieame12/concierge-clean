import type { Request, RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}

interface Bucket {
  count: number;
  expires: number;
}

export const createRateLimiter = ({ windowMs, max, keyGenerator }: RateLimitOptions): RequestHandler => {
  const effectiveWindow = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000;
  const effectiveMax = Number.isFinite(max) ? max : 120;

  if (effectiveMax <= 0) {
    return (_req, _res, next) => next();
  }

  const buckets = new Map<string, Bucket>();

  const getKey = (req: Request) => {
    if (keyGenerator) return keyGenerator(req);
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length) {
      const [first] = forwarded.split(',');
      if (first) return first.trim();
    }
    if (Array.isArray(forwarded) && forwarded.length) {
      return forwarded[0];
    }
    return req.ip || 'unknown';
  };

  const cleanup = (now: number) => {
    if (buckets.size < 2_000) return;
    for (const [key, bucket] of buckets) {
      if (bucket.expires <= now) {
        buckets.delete(key);
      }
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    const key = getKey(req);

    let bucket = buckets.get(key);
    if (!bucket || bucket.expires <= now) {
      bucket = { count: 0, expires: now + effectiveWindow };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > effectiveMax) {
      const retryAfterSeconds = Math.max(Math.ceil((bucket.expires - now) / 1000), 1);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: 'Too many requests, please slow down.' });
      return;
    }

    cleanup(now);
    next();
  };
};
