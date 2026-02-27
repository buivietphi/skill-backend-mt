# Database Design Patterns

> SQL, NoSQL, ORM patterns, migrations, query optimization.

---

## Database Selection Matrix

**ASK these questions FIRST. Then recommend the right database.**

```
QUESTION                              → RECOMMENDATION
──────────────────────────────────────────────────────────────────
Complex relations (joins, FK, ACID)?  → PostgreSQL (default choice)
Simple CRUD, MySQL team experience?   → MySQL / MariaDB
Flexible schema, rapid prototyping?   → MongoDB
Document-heavy (CMS, logs, events)?   → MongoDB / DynamoDB
Time-series data (metrics, IoT)?      → TimescaleDB / InfluxDB
Full-text search?                     → Elasticsearch / PostgreSQL (tsvector)
Key-value / session cache?            → Redis
Graph relationships (social, fraud)?  → Neo4j / Amazon Neptune
Serverless, auto-scaling?             → PlanetScale (MySQL) / Neon (PostgreSQL) / DynamoDB
Embedded / local-first?               → SQLite
```

### Decision Flow
```
START → "Do you need ACID transactions?"
  YES → "Complex relations / joins?"
    YES → PostgreSQL ← DEFAULT for most backend apps
    NO  → MySQL (simpler, good replication)
  NO  → "Schema will change frequently?"
    YES → MongoDB (flexible schema)
    NO  → "Key-value access pattern?"
      YES → Redis / DynamoDB
      NO  → PostgreSQL (safest default)

RULE: When in doubt, pick PostgreSQL. It handles 90% of use cases.
RULE: WebSearch "[database] vs [database] [use case] [year]" for edge cases.
RULE: In project mode → use whatever the project already uses. NEVER switch.
```

### Multi-Database Architecture
```
PATTERN: Polyglot persistence — use the RIGHT database for each job:
  Primary data (users, orders)        → PostgreSQL / MySQL
  Cache (sessions, hot data)          → Redis
  Search (full-text, filters)         → Elasticsearch
  Analytics (OLAP, reporting)         → ClickHouse / BigQuery
  File metadata + blobs               → PostgreSQL + S3

RULE: Start with ONE database. Add more ONLY when you have evidence of need.
⛔ Don't use MongoDB just because "NoSQL is faster" — it's not (for most use cases).
⛔ Don't use Redis as primary storage — it's a cache, not a database (unless Redis AOF/RDB + use case fits).
```

---

## Schema Design

### SQL (Relational)

**Normalization Rules:**
```
1NF: Atomic values (no arrays in columns)
2NF: No partial dependencies (every non-key depends on full PK)
3NF: No transitive dependencies (non-key depends only on PK)

PRACTICAL RULE: Normalize first, denormalize for performance ONLY with evidence.
```

**Common Table Patterns:**
```sql
-- Users table (core)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Soft delete pattern
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
-- IMPORTANT: Add WHERE deleted_at IS NULL to all queries

-- Audit trail
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### NoSQL (Document)

**MongoDB Document Design:**
```
EMBEDDING (denormalize):
  ✅ Data accessed together (user + profile)
  ✅ One-to-few relationships
  ✅ Data doesn't change independently

REFERENCING (normalize):
  ✅ One-to-many relationships
  ✅ Many-to-many relationships
  ✅ Data accessed independently
  ✅ Data changes frequently
```

---

## ORM Patterns

### Prisma (Node.js)
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  orders    Order[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Always use select/include to avoid over-fetching
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true }
});
```

### TypeORM (Node.js)
```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;
}

// Use QueryBuilder for complex queries
const users = await userRepo
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.orders', 'order')
  .where('user.isActive = :active', { active: true })
  .getMany();
```

### SQLAlchemy (Python)
```python
class User(Base):
    __tablename__ = "users"

    id = Column(UUID, primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False)
    orders = relationship("Order", back_populates="user", lazy="selectin")

# Async session
async with async_session() as session:
    result = await session.execute(
        select(User).where(User.is_active == True).limit(20)
    )
    users = result.scalars().all()
```

### Eloquent (Laravel)
```php
class User extends Model {
    protected $fillable = ['email', 'name'];
    protected $hidden = ['password'];

    public function orders(): HasMany {
        return $this->hasMany(Order::class);
    }
}

// Eager loading to prevent N+1
$users = User::with('orders')->where('is_active', true)->paginate(20);
```

### Spring Data JPA (Java)
```java
@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private List<Order> orders;
}

// Repository with custom query
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.orders WHERE u.isActive = true")
    List<User> findActiveUsersWithOrders();
}
```

---

## Migration Best Practices

```
RULES:
  1. ALWAYS write both UP and DOWN migrations
  2. NEVER modify a migration that's been applied in production
  3. NEVER drop columns directly — deprecate first, remove later
  4. ALWAYS test migration on a copy of production data
  5. ALWAYS add indexes in a separate migration (non-blocking)
  6. Use transactions for data migrations (rollback on failure)

SAFE COLUMN OPERATIONS:
  ✅ Add nullable column (no lock)
  ✅ Add column with default (may lock briefly)
  ⚠️ Add NOT NULL column (requires default or backfill)
  ⛔ Rename column (breaks existing queries)
  ⛔ Change column type (data loss risk)
  ⛔ Drop column (breaks existing code)

SAFE INDEX OPERATIONS:
  ✅ CREATE INDEX CONCURRENTLY (PostgreSQL — no lock)
  ⚠️ CREATE INDEX (locks table during build)
```

---

## Query Optimization

### N+1 Query Detection
```
SYMPTOM: For N records, you see N+1 queries in logs:
  SELECT * FROM users;          -- 1 query
  SELECT * FROM orders WHERE user_id = 1;  -- N queries
  SELECT * FROM orders WHERE user_id = 2;
  ...

FIX: Use JOIN or eager loading:
  SELECT u.*, o.* FROM users u LEFT JOIN orders o ON u.id = o.user_id;

  ORM equivalents:
    Prisma:   include: { orders: true }
    TypeORM:  relations: ['orders'] or leftJoinAndSelect
    Django:   select_related('orders') or prefetch_related('orders')
    Laravel:  User::with('orders')
    Spring:   @EntityGraph or JOIN FETCH
```

### Indexing Strategy
```
INDEX WHEN:
  ✅ Column used in WHERE clauses frequently
  ✅ Column used in ORDER BY
  ✅ Column used in JOIN conditions
  ✅ Column used in unique constraints
  ✅ Foreign key columns

DON'T INDEX WHEN:
  ⛔ Table has fewer than 1000 rows
  ⛔ Column has very low cardinality (boolean)
  ⛔ Column is rarely queried
  ⛔ Table has heavy writes (indexes slow inserts)

COMPOSITE INDEX RULE:
  Index (A, B, C) works for queries on:
    WHERE A = ?
    WHERE A = ? AND B = ?
    WHERE A = ? AND B = ? AND C = ?
  Does NOT work for:
    WHERE B = ?
    WHERE C = ?
    WHERE B = ? AND C = ?
```

### Connection Pooling
```
SETTINGS:
  min connections: 2-5 (keep warm)
  max connections: 10-20 (per instance)
  idle timeout: 30s
  connection timeout: 5s

FORMULA: max_connections = (num_instances × pool_size) < DB max_connections
  Example: 4 instances × 15 pool = 60 < 100 (PostgreSQL default)

ALWAYS: Release connections back to pool after use (finally/using blocks)
```

### Transactions
```
USE TRANSACTIONS WHEN:
  ✅ Multiple related writes (create order + update inventory)
  ✅ Financial operations (debit + credit)
  ✅ Multi-step data migrations

ISOLATION LEVELS:
  READ COMMITTED   → Default for most ORMs. Prevents dirty reads.
  REPEATABLE READ  → Prevents non-repeatable reads. Use for reports.
  SERIALIZABLE     → Strictest. Use for financial transactions.

RULE: Use the lowest isolation level that meets your needs.
```

---

## Data Integrity Protocol

**RULE 9 enforcement — require explicit confirmation before any destructive operation.**

```
⛔ REQUIRE USER CONFIRMATION before running:
  - DROP TABLE / DROP DATABASE
  - TRUNCATE (removes all rows, non-transactional on some engines)
  - DELETE FROM {table} (without WHERE clause)
  - UPDATE {table} SET ... (without WHERE clause)
  - ALTER COLUMN type change (data loss risk)
  - Removing NOT NULL constraint then dropping column

CONFIRMATION FLOW:
  1. Show: "This will [describe what is deleted/destroyed]. Confirm? (yes/no)"
  2. Wait for explicit "yes" or "confirm"
  3. ONLY THEN execute
  4. Log: what was deleted, when, by whom

✅ ALWAYS SAFE (no confirmation needed):
  - CREATE TABLE, ADD COLUMN (nullable)
  - CREATE INDEX CONCURRENTLY
  - INSERT, SELECT
  - UPDATE with specific WHERE id = $1
  - DELETE with specific WHERE id = $1
```

## Zero-Downtime Migration Strategy

```
WHEN adding NOT NULL column to existing table:

  Phase 1 (deploy code v1 → reads both old+new):
    ALTER TABLE users ADD COLUMN phone VARCHAR(20);  -- nullable first

  Phase 2 (backfill data):
    UPDATE users SET phone = '' WHERE phone IS NULL;

  Phase 3 (add constraint):
    ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

  Phase 4 (deploy code v2 → uses only new column):
    -- now safe to drop old column in Phase 5

  Phase 5 (next release):
    ALTER TABLE users DROP COLUMN old_phone;

RULE: Each phase is a separate migration + separate deploy.
RULE: Never lock a production table > 1s. Use CONCURRENTLY for indexes.
```
