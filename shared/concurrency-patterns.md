# Concurrency & State Management Patterns

> Locking, idempotency, race conditions — real code, not theory.
> Optimistic/pessimistic locking, distributed locks, idempotency keys.

---

## Optimistic Locking

```
CONCEPT: Add version column. Check version on update. If mismatch → retry.
USE WHEN: Low contention, reads >> writes, short update operations.
```

### SQL

```sql
-- Read with version
SELECT id, name, balance, version FROM accounts WHERE id = $1;
-- Returns: { id: 1, name: 'Alice', balance: 1000, version: 5 }

-- Update with version check
UPDATE accounts
SET balance = balance - 100, version = version + 1
WHERE id = $1 AND version = $2;  -- version = 5

-- If 0 rows affected → someone else updated first → retry
```

### Node.js (Prisma)

```typescript
async transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const from = await tx.account.findUnique({ where: { id: fromId } });
        if (!from) throw new NotFoundException('Source account');
        if (from.balance < amount) throw new BusinessRuleException('Insufficient funds', 'INSUFFICIENT_FUNDS');

        // Optimistic lock: update only if version matches
        const result = await tx.account.updateMany({
          where: { id: fromId, version: from.version },
          data: { balance: { decrement: amount }, version: { increment: 1 } },
        });

        if (result.count === 0) {
          throw new OptimisticLockException('Account was modified by another transaction');
        }

        await tx.account.update({
          where: { id: toId },
          data: { balance: { increment: amount }, version: { increment: 1 } },
        });
      });

      return; // Success — exit retry loop
    } catch (error) {
      if (error instanceof OptimisticLockException && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 50 * attempt)); // brief backoff
        continue; // Retry
      }
      throw error;
    }
  }
}
```

---

## Pessimistic Locking

```
CONCEPT: Lock the row in DB during transaction. Others wait.
USE WHEN: High contention, writes are common, data integrity critical.
```

### SQL

```sql
-- SELECT FOR UPDATE locks the row until transaction commits/rollbacks
BEGIN;
  SELECT * FROM accounts WHERE id = $1 FOR UPDATE;  -- LOCKS this row
  UPDATE accounts SET balance = balance - 100 WHERE id = $1;
COMMIT;  -- releases lock
```

### Node.js (Prisma raw query)

```typescript
async deductBalance(accountId: string, amount: number): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // Lock the row
    const [account] = await tx.$queryRaw<Account[]>`
      SELECT * FROM accounts WHERE id = ${accountId} FOR UPDATE
    `;

    if (!account) throw new NotFoundException('Account');
    if (account.balance < amount) throw new BusinessRuleException('Insufficient funds', 'INSUFFICIENT_FUNDS');

    await tx.account.update({
      where: { id: accountId },
      data: { balance: { decrement: amount } },
    });
  });
}
```

### Python (SQLAlchemy)

```python
async def deduct_balance(self, account_id: str, amount: Decimal):
    async with self.session.begin():
        # Lock the row
        account = await self.session.execute(
            select(Account).where(Account.id == account_id).with_for_update()
        )
        account = account.scalar_one_or_none()

        if not account:
            raise NotFoundException("Account")
        if account.balance < amount:
            raise BusinessRuleException("Insufficient funds")

        account.balance -= amount
```

---

## Distributed Locking (Redis)

```
USE WHEN: Multiple server instances need to coordinate.
EXAMPLES: Scheduled job runs on one instance only, prevent duplicate processing.
```

```typescript
class DistributedLock {
  constructor(private readonly redis: Redis) {}

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const lockValue = crypto.randomUUID(); // unique per lock holder
    const acquired = await this.redis.set(
      `lock:${key}`, lockValue, 'PX', ttlMs, 'NX',
    );
    return acquired ? lockValue : null;
  }

  async release(key: string, lockValue: string): Promise<boolean> {
    // Lua script: only delete if still our lock (atomic)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, `lock:${key}`, lockValue);
    return result === 1;
  }
}

// Usage:
async processScheduledJob(jobId: string): Promise<void> {
  const lockValue = await this.lock.acquire(`job:${jobId}`, 30000); // 30s TTL
  if (!lockValue) {
    this.logger.info('Job already being processed by another instance');
    return;
  }

  try {
    await this.doWork(jobId);
  } finally {
    await this.lock.release(`job:${jobId}`, lockValue);
  }
}
```

---

## Idempotency Keys

```
CONCEPT: Client sends unique key. Server checks if already processed.
USE WHEN: Payment processing, order placement — any non-idempotent operation.
```

```typescript
// Middleware: extract and validate idempotency key
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req['idempotencyKey'] = req.headers['idempotency-key'] as string;
    }
    next();
  }
}

// Service: check and store
async createOrder(dto: CreateOrderDto, idempotencyKey?: string): Promise<OrderResponseDto> {
  // 1. CHECK if already processed
  if (idempotencyKey) {
    const existing = await this.prisma.idempotentRequest.findUnique({
      where: { key: idempotencyKey },
    });
    if (existing) {
      return JSON.parse(existing.response); // Return cached response
    }
  }

  // 2. EXECUTE
  const order = await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data: dto as any });

    // Store idempotency record (inside same transaction)
    if (idempotencyKey) {
      await tx.idempotentRequest.create({
        data: {
          key: idempotencyKey,
          response: JSON.stringify(this.mapToDto(order)),
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24h
        },
      });
    }

    return order;
  });

  return this.mapToDto(order);
}
```

```sql
-- Idempotency table
CREATE TABLE idempotent_requests (
  key        VARCHAR(255) PRIMARY KEY,
  response   JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotent_expires ON idempotent_requests(expires_at);
-- Cleanup: DELETE FROM idempotent_requests WHERE expires_at < NOW();
```

---

## Race Condition Prevention Checklist

```
SCENARIO: Two users buy last item in stock
  ⛔ READ stock → check → UPDATE (TOCTOU race)
  ✅ UPDATE stock SET quantity = quantity - 1 WHERE id = $1 AND quantity >= 1
     → Atomic: check + update in ONE statement

SCENARIO: Two requests create same unique resource
  ⛔ SELECT to check exists → INSERT (race: both pass SELECT)
  ✅ INSERT with unique constraint → catch error → "already exists"
  ✅ Or: INSERT ... ON CONFLICT DO NOTHING → check if inserted

SCENARIO: Double payment (user clicks pay twice)
  ⛔ Both requests process payment
  ✅ Idempotency key → second request returns cached response

SCENARIO: Concurrent balance updates
  ⛔ Read balance → calculate new → write (lost update)
  ✅ UPDATE balance = balance - amount WHERE balance >= amount (atomic)
  ✅ Or: SELECT FOR UPDATE → update → commit (pessimistic lock)

SCENARIO: Scheduled job runs on multiple instances
  ⛔ All instances execute the same job
  ✅ Distributed lock (Redis) → only one instance acquires lock

SCENARIO: Cache stampede (cache expires, 100 concurrent reads)
  ⛔ All 100 requests hit DB
  ✅ Mutex lock → first request fetches, others wait (see caching-implementation.md)
```

---

## Decision Matrix

```
                        OPTIMISTIC    PESSIMISTIC    DISTRIBUTED    ATOMIC SQL
Low contention            ✅              ⚠️             ❌            ✅
High contention           ⚠️              ✅             ⚠️            ✅
Cross-service             ❌              ❌             ✅            ❌
Simple increment          ❌              ❌             ❌            ✅
Long transaction          ❌              ⚠️             ✅            ❌
Financial operations      ✅              ✅             ✅            ✅

✅ = recommended  ⚠️ = works but not optimal  ❌ = not suitable
```
