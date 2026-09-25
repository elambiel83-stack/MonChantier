import Redis from 'ioredis';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

// Limiteur en mémoire de process : repli utilisé en dev, ou en production si
// REDIS_URL n'est pas configuré. Ne protège rien dès qu'il y a plusieurs
// instances/replicas (chacune a son propre compteur), et perd tout son état
// à froid en serverless — d'où le passage à Redis ci-dessous quand disponible.
type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();

function checkRateLimitInMemory(key: string, opts: { max: number; windowMs: number }): RateLimitResult {
  const now = Date.now();

  if (memoryBuckets.size > 10000) {
    for (const [k, b] of memoryBuckets) {
      if (b.resetAt <= now) memoryBuckets.delete(k);
    }
  }

  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= opts.max) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: opts.max - bucket.count, retryAfterMs: 0 };
}

// Quand REDIS_URL est défini, le compteur est partagé entre toutes les
// instances du serveur (INCR + PEXPIRE atomiques), ce qui rend le rate
// limiting réellement efficace en production multi-instance.
declare global {
  // eslint-disable-next-line no-var
  var __monchantier_redis__: Redis | undefined;
}

function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!globalThis.__monchantier_redis__) {
    globalThis.__monchantier_redis__ = new Redis(url, { maxRetriesPerRequest: 1 });
    globalThis.__monchantier_redis__.on('error', (err) => {
      console.error('Redis (rate limit) indisponible, repli sur la mémoire locale:', err.message);
    });
  }
  return globalThis.__monchantier_redis__;
}

async function checkRateLimitInRedis(
  client: Redis,
  key: string,
  opts: { max: number; windowMs: number }
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const count = await client.incr(redisKey);
  if (count === 1) {
    await client.pexpire(redisKey, opts.windowMs);
  }
  if (count > opts.max) {
    const ttl = await client.pttl(redisKey);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(ttl, 0) };
  }
  return { allowed: true, remaining: Math.max(opts.max - count, 0), retryAfterMs: 0 };
}

// Bascule automatiquement sur Redis quand REDIS_URL est configuré, avec
// repli mémoire locale si Redis est indisponible ou non configuré (fail-open
// sur l'infra, pas sur la sécurité : la limite continue de s'appliquer,
// juste par instance plutôt que globale tant que Redis n'est pas joignable).
export async function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): Promise<RateLimitResult> {
  const client = getRedisClient();
  if (!client) return checkRateLimitInMemory(key, opts);
  try {
    return await checkRateLimitInRedis(client, key, opts);
  } catch (error) {
    console.error('Redis (rate limit) en erreur, repli sur la mémoire locale:', error);
    return checkRateLimitInMemory(key, opts);
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
