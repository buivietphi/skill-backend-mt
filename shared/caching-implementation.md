# Caching Implementation Patterns

> Production caching: cache-aside, write-through, invalidation, Redis patterns.
> Real code, not concepts.

---

## Cache-Aside (Lazy Loading) — Most Common

```
READ: Check cache → hit? return → miss? fetch DB → store in cache → return
WRITE: Update DB → delete cache key (NOT update cache)
```

### Node.js (Redis + ioredis)

```typescript
// Generic cache-aside wrapper
class CacheService {
  constructor(private readonly redis: Redis) {}

  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    // 1. Check cache
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    // 2. Cache miss — fetch from source
    const data = await fetcher();

    // 3. Store in cache (don't block response)
    this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch(err =>
      this.logger.warn('Cache set failed', { key, error: err.message }),
    );

    return data;
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Use SCAN (NOT KEYS) in production — KEYS blocks Redis
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await this.redis.del(...keys);
    } while (cursor !== '0');
  }
}
```

```typescript
// Usage in service
class OrderService {
  async findById(id: string): Promise<OrderResponseDto> {
    return this.cache.getOrSet(
      `order:${id}`,          // key
      300,                     // TTL: 5 minutes
      () => this.orderRepo.findById(id).then(this.mapToDto),  // fetcher
    );
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderResponseDto> {
    const updated = await this.orderRepo.update(id, dto);

    // Invalidate (don't update cache — avoids stale race condition)
    await this.cache.invalidate(`order:${id}`);
    await this.cache.invalidatePattern(`orders:list:*`);  // invalidate all list caches

    return this.mapToDto(updated);
  }
}
```

### Python (Redis)

```python
class CacheService:
    def __init__(self, redis: Redis):
        self.redis = redis

    async def get_or_set(self, key: str, ttl_seconds: int, fetcher):
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)

        data = await fetcher()
        await self.redis.set(key, json.dumps(data, default=str), ex=ttl_seconds)
        return data

    async def invalidate(self, key: str):
        await self.redis.delete(key)

# Usage:
order = await cache.get_or_set(
    f"order:{order_id}", 300,
    lambda: order_repo.find_by_id(order_id)
)
```

---

## Cache Key Design

```
PATTERN: {entity}:{scope}:{identifier}:{version}

EXAMPLES:
  order:single:ord_abc123          — single entity
  orders:list:user_123:page_1      — list for user, page 1
  orders:list:admin:status_pending  — filtered list
  orders:count:user_123            — count for user
  user:profile:usr_456             — user profile
  config:settings:v2               — versioned config

RULES:
  ✅ Use colon (:) separator — Redis convention
  ✅ Include scope (single/list/count) — easy pattern invalidation
  ✅ Include user/tenant for multi-tenant — prevent data leak
  ✅ Include version for config — easy rolling update
  ⛔ NEVER put user input directly in key — sanitize first
  ⛔ NEVER use KEYS command in production — use SCAN
```

---

## Invalidation Strategies

```
STRATEGY 1: Delete on write (recommended)
  → Update DB → delete cache key
  → Next read will cache miss → fetch fresh data
  → Simple, no stale data, slight latency on first read after write

STRATEGY 2: TTL-based expiry (for non-critical data)
  → Set TTL on cache → auto-expire
  → Acceptable staleness: stats, dashboards, leaderboards
  → TTL guide: 60s for dashboards, 300s for lists, 3600s for config

STRATEGY 3: Event-driven invalidation (for distributed systems)
  → Service A updates DB → publishes event
  → Cache service listens → invalidates relevant keys
  → Best for microservices where multiple services cache same data

STRATEGY 4: Write-through (for hot data)
  → Write to cache AND DB simultaneously
  → Guarantees cache is always fresh
  → Higher write latency, but zero read miss
```

```typescript
// Event-driven invalidation
@OnEvent('order.updated')
async handleOrderUpdated(event: { orderId: string; customerId: string }) {
  await Promise.all([
    this.cache.invalidate(`order:single:${event.orderId}`),
    this.cache.invalidatePattern(`orders:list:${event.customerId}:*`),
    this.cache.invalidatePattern(`orders:list:admin:*`),
  ]);
}
```

---

## Multi-Level Cache

```
L1: In-memory (Map/LRU) — 10ms, small, per-instance
L2: Redis — 1-5ms, shared, consistent
L3: Database — 10-100ms, source of truth

READ FLOW:
  Check L1 → hit? return
  Check L2 → hit? store in L1 → return
  Query L3 → store in L2 + L1 → return
```

```typescript
class MultiLevelCache {
  private l1 = new Map<string, { data: any; expiresAt: number }>();

  async get<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    // L1: in-memory
    const local = this.l1.get(key);
    if (local && local.expiresAt > Date.now()) return local.data;

    // L2: Redis
    const cached = await this.redis.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      this.l1.set(key, { data, expiresAt: Date.now() + 30_000 }); // L1 TTL: 30s
      return data;
    }

    // L3: Database
    const data = await fetcher();
    await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
    this.l1.set(key, { data, expiresAt: Date.now() + 30_000 });
    return data;
  }
}
```

---

## Cache Stampede Prevention

```
PROBLEM: Cache expires → 100 concurrent requests all miss → 100 DB queries

SOLUTION 1: Mutex lock (recommended)
  First request acquires lock → fetches data → sets cache → releases lock
  Other requests wait for lock → then read from cache

SOLUTION 2: Stale-while-revalidate
  Return stale data immediately → refresh cache in background

SOLUTION 3: Early expiry (probabilistic)
  Each request has a chance of refreshing cache BEFORE actual TTL
```

```typescript
// Mutex lock approach
async getOrSetWithLock<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const acquired = await this.redis.set(lockKey, '1', 'EX', 10, 'NX'); // lock for 10s

  if (acquired) {
    try {
      const data = await fetcher();
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
      return data;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  // Lock not acquired — wait and retry
  await new Promise(r => setTimeout(r, 100));
  return this.getOrSetWithLock(key, ttl, fetcher);
}
```

---

## Common Caching Mistakes

```
⛔ Caching null/empty results without TTL → permanent "not found"
  ✅ Cache empty results with SHORT TTL (30-60s) to prevent repeated DB hits

⛔ Cache key without tenant/user → data leaks between users
  ✅ Always include user ID or tenant ID in cache keys

⛔ Updating cache instead of invalidating → stale race condition
  ✅ DELETE on write, let next READ populate fresh data

⛔ No cache warming → cold start slow
  ✅ Pre-warm critical data on deploy (config, popular items)

⛔ No TTL → memory leak + permanent stale data
  ✅ EVERY key must have TTL — even "permanent" config (set 24h)

⛔ Using KEYS * in production → blocks Redis
  ✅ Use SCAN with COUNT for pattern matching

⛔ Storing large objects → slow serialization + high memory
  ✅ Store only what's needed (IDs, computed values, not full entities)

⛔ Cache and DB out of sync after failed DB write
  ✅ Delete cache AFTER successful DB write (not before)
```
