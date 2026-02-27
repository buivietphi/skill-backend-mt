# Backend Performance Optimization

> Caching, connection pooling, query optimization, async processing.

---

## Caching Strategy

### Multi-Level Cache
```
┌──────────────────────────────────────────────────────┐
│  L1: In-Memory (Map/LRU)  │  ~0.01ms  │  Per-instance  │
├──────────────────────────────────────────────────────┤
│  L2: Redis/Memcached      │  ~1ms     │  Shared         │
├──────────────────────────────────────────────────────┤
│  L3: CDN                  │  ~10ms    │  Edge           │
├──────────────────────────────────────────────────────┤
│  L4: Database             │  ~50ms    │  Source of truth │
└──────────────────────────────────────────────────────┘

FLOW: Check L1 → miss → Check L2 → miss → Check L3 → miss → Query L4 → populate caches
```

### Cache Invalidation
```
STRATEGY 1: Time-Based (TTL)
  Set expiry on cache entries. Simple but may serve stale data.
  Good for: User profiles, product catalogs, config

STRATEGY 2: Event-Based
  Invalidate cache when data changes (on write/update/delete).
  Good for: Real-time data, frequently updated resources

STRATEGY 3: Write-Through
  Update cache simultaneously with database.
  Good for: Critical data that must always be fresh

STRATEGY 4: Cache-Aside (Lazy Loading)
  Read: check cache → miss → query DB → populate cache
  Write: update DB → invalidate cache
  Good for: General purpose, most common pattern

COMMON PATTERNS:
  cache:users:123          → Single user (TTL: 5-15 min)
  cache:users:list:page:1  → Paginated list (TTL: 1-5 min)
  cache:config:app         → App config (TTL: 1 hour)

⛔ NEVER cache authentication tokens or session data in shared cache without encryption
⛔ NEVER cache without TTL (memory will grow unbounded)
```

### Redis Best Practices
```
✅ Use appropriate data structures (String, Hash, Set, Sorted Set, List)
✅ Set TTL on all keys (EXPIRE/SETEX)
✅ Use key namespacing: "service:entity:id" → "user-service:users:123"
✅ Use pipeline for batch operations
✅ Monitor memory usage (INFO memory)
✅ Configure maxmemory-policy (allkeys-lru recommended)
⛔ NEVER use KEYS command in production (blocks Redis, O(n))
⛔ NEVER store large objects (> 1MB) without compression
```

---

## Database Query Optimization

### N+1 Query Fix
```
PROBLEM:
  const users = await db.query('SELECT * FROM users LIMIT 10');
  for (const user of users) {
    user.orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [user.id]);
  }
  // 11 queries! (1 for users + 10 for orders)

FIX:
  const users = await db.query(`
    SELECT u.*, json_agg(o.*) as orders
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    LIMIT 10
  `);
  // 1 query!

ORM EQUIVALENTS:
  Prisma:     findMany({ include: { orders: true } })
  TypeORM:    find({ relations: ['orders'] })
  Django:     User.objects.prefetch_related('orders')[:10]
  Laravel:    User::with('orders')->limit(10)->get()
  Spring:     @EntityGraph(attributePaths = {"orders"})
```

### Indexing Checklist
```
□ Primary keys (automatic)
□ Foreign keys (often missed!)
□ Columns in WHERE clauses
□ Columns in ORDER BY
□ Columns in JOIN conditions
□ Unique constraints
□ Composite indexes for multi-column queries

VERIFY: EXPLAIN ANALYZE your slow queries
  PostgreSQL: EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...
  MySQL:      EXPLAIN FORMAT=TREE SELECT ...
```

### Pagination Performance
```
OFFSET-BASED (slow for large offsets):
  SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 10000;
  // DB must skip 10,000 rows before returning 20. Slow!

CURSOR-BASED (constant performance):
  SELECT * FROM orders WHERE id > $lastId ORDER BY id LIMIT 20;
  // Uses index scan. Always fast regardless of page number.

RECOMMENDATION: Cursor-based for any table > 10k rows
```

---

## Connection Pooling

```
WHY: Creating a new DB connection takes 20-100ms. Reusing is ~0ms.

SETTINGS:
  Pool size = (number of CPU cores × 2) + effective_spindle_count
  Typical: 10-20 connections per application instance

FORMULA:
  Total connections = instances × pool_size
  Must be < database max_connections

  Example: 4 instances × 15 = 60 < 100 (PostgreSQL default)

LIBRARIES:
  Node.js:   Built into Prisma, TypeORM; pg-pool for raw
  Python:    SQLAlchemy pool, asyncpg pool
  Java:      HikariCP (Spring default)
  PHP:       Built into Laravel, PDO persistent connections
  Go:        database/sql built-in pool

MONITOR:
  - Active connections vs pool max
  - Wait time for connection from pool
  - Connection lifetime and idle timeout
```

---

## Async Processing

### Message Queues
```
USE QUEUE WHEN:
  ✅ Operation takes > 1 second (email, PDF generation, image processing)
  ✅ Operation can be retried independently
  ✅ Operation doesn't need immediate response
  ✅ Need to decouple services

TOOLS:
  Redis (Bull/BullMQ)   → Simple, fast, good for Node.js
  RabbitMQ              → Feature-rich, routing, dead letter queues
  Apache Kafka          → High throughput, event streaming, replay
  AWS SQS               → Managed, serverless, auto-scaling

PATTERN:
  API → Publish to queue → Return 202 Accepted
  Worker → Consume from queue → Process → Acknowledge

RETRY STRATEGY:
  Attempt 1: Immediate
  Attempt 2: After 1 minute
  Attempt 3: After 5 minutes
  Attempt 4: After 30 minutes
  Dead Letter Queue: After all retries exhausted
```

### Background Jobs
```
Node.js:   BullMQ, Agenda
Python:    Celery, Dramatiq, RQ
Java:      Spring @Async, Quartz Scheduler
PHP:       Laravel Queue, Symfony Messenger
Go:        Asynq, Machinery

EVERY JOB MUST:
  ✅ Be idempotent (safe to run multiple times)
  ✅ Have timeout (don't hang forever)
  ✅ Log start, completion, and errors
  ✅ Handle failures gracefully (retry or dead letter)
```

---

## Response Compression

```
✅ Enable gzip/brotli for responses > 1KB
✅ Set appropriate Content-Encoding headers
✅ Compress JSON responses (typical 70-80% reduction)

Node.js:   compression middleware
Python:    GZipMiddleware (FastAPI/Starlette)
Java:      server.compression.enabled=true (Spring Boot)
PHP:       Laravel handles via web server config
Nginx:     gzip on; gzip_types application/json;
```

---

## Performance Checklist

```
□ Database queries use indexes (EXPLAIN ANALYZE)
□ No N+1 queries
□ All list endpoints are paginated
□ Connection pooling configured
□ Caching for frequently accessed data
□ Expensive operations offloaded to queue
□ Response compression enabled
□ Timeout configured for all external calls
□ Rate limiting to prevent abuse
□ Database connection pool monitoring
```
