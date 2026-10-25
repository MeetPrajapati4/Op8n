interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStores = new Map<string, Map<string, RateLimitRecord>>();

/**
 * Checks and updates rate limit for a given IP in a named bucket.
 * Default for settings: 10 requests per minute per IP.
 */
export function checkRateLimit(
  ip: string,
  bucket = 'settings',
  maxRequests = 10,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  let store = rateLimitStores.get(bucket);
  if (!store) {
    store = new Map<string, RateLimitRecord>();
    rateLimitStores.set(bucket, store);
  }

  const now = Date.now();
  const record = store.get(ip);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + windowMs,
    };
    store.set(ip, newRecord);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newRecord.resetTime,
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
