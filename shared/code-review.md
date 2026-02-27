# Backend Code Review Checklist

> Senior engineer review protocol. Patterns from Google, Microsoft, Stripe, Facebook, Uber engineering.
> 13 tiers covering: verification, architecture, security, concurrency, performance, caching, resources, compatibility, observability, privacy, deploy safety, testing, code quality.

---

## Review Protocol

```
STEP 1: BEFORE reviewing — verify what you're looking at
  - Read ALL files in the PR/change (not just the diff)
  - Identify: which modules touched? which dependencies used?
  - Check PR size: >400 lines → suggest splitting (review quality drops above 400 LOC)
  - Run Tier 0 (Verification) FIRST

STEP 2: Run tiers IN ORDER (Tier 0 → Tier 12)
  - Each tier has checkboxes — check every one
  - Any CRITICAL finding → flag immediately, don't continue until acknowledged
  - Skip tiers only if they're clearly irrelevant (e.g., skip Tier 7 if no caching code)

STEP 3: Produce Review Report (use output format at bottom)
  - Every finding must have: severity + file:line + description + suggestion
  - Group by severity (CRITICAL → HIGH → MEDIUM → LOW)

⛔ NEVER say "looks good" without running ALL relevant tiers
⛔ NEVER review from memory — Read every file being reviewed
⛔ NEVER skip Tier 0 — phantom APIs are the #1 source of review failures
```

---

## Review Tiers (In Order)

### Tier 0: Verification — Library & API Existence (CRITICAL)

**Catches the #1 review failure: referencing APIs/functions that don't exist.**

```
── DEPENDENCY CHECK ──
□ Every import resolves to an installed package
  → Check package.json / requirements.txt / pom.xml / composer.json / go.mod / Cargo.toml
  → If package NOT listed → CRITICAL: "Package X is not installed"
  → If package version pinned → check if imported API exists in THAT version

□ No phantom functions (function called but doesn't exist in library)
  → For each library function call: verify it exists in the installed version
  → Common traps:
    - Function renamed between versions (e.g., prisma.findUnique vs findOne)
    - Function only in community plugin, not core (e.g., @nestjs/mapped-types)
    - Function exists in v3 docs but project uses v2
    - Function from a DIFFERENT library with similar name
  → If uncertain → WebSearch "[library] [version] [function name] API"

□ No deprecated APIs
  → Check if any used function/method is marked @deprecated
  → Common: Express res.send() patterns, Mongoose callbacks, Sequelize v5→v6
  → WebSearch "[library] deprecated functions [version]" if uncertain
  → Flag deprecated with: "⚠️ Deprecated since [version]. Use [replacement] instead."

□ Import paths are correct for the installed version
  → Breaking change between versions often changes import path
  → Examples:
    - @nestjs/common vs @nestjs/core (different exports)
    - next/server vs next/headers (App Router vs Pages Router)
    - fastapi.security vs fastapi.security.oauth2
    - spring-boot 2.x vs 3.x (javax → jakarta package rename)
    - Laravel 10→11 facade changes

── TYPE & SIGNATURE CHECK ──
□ Function signatures match library documentation
  → Parameter count, parameter types, return type
  → TypeScript: generic type parameters match
  → Python: keyword arguments match (positional vs named)

□ No wrong return type assumptions
  → findOne() returns T | null — null handled?
  → findMany() returns T[] — empty array handled?
  → Promise<T> — awaited? .then()/.catch()?

□ Config objects use correct property names
  → TypeORM: "synchronize" not "sync"
  → Prisma: "datasources" not "datasource" (plural)
  → Mongoose: "useNewUrlParser" (deprecated but still seen)
  → Spring: "spring.datasource.url" not "spring.database.url"

── VERIFICATION METHOD ──
For EVERY library call you're unsure about:
  1. Check project lockfile for exact installed version
  2. Read the library's type definitions or source (node_modules/@types/ or actual source)
  3. If still uncertain → WebSearch "[library] [version] [function] documentation [year]"
  ⛔ NEVER confirm a function exists based on memory alone
  ⛔ NEVER say "this function should work" — verify it DOES work
```

### Tier 1: Architecture (CRITICAL)
```
□ Separation of concerns (controller → service → repository)
□ Dependency direction (outer → inner, never reverse)
□ Single responsibility (one service = one domain)
□ No circular dependencies between modules
□ No business logic in controllers/routes
□ No database queries in controllers
□ API contract preserved (no unversioned breaking changes)
□ New code follows existing module structure (Project Mode: EXACT match)
```

### Tier 2: Security (CRITICAL)
```
□ Input validated at entry point (DTO/schema validation)
□ Auth middleware on all protected routes
□ No raw SQL with string interpolation
□ No hardcoded secrets (API keys, passwords, tokens)
□ No sensitive data in logs (password, token, credit card, PII)
□ No wildcard CORS in production config
□ Parameterized queries for ALL database access
□ Rate limiting on public endpoints
□ Authorization check (not just authentication — user owns the resource?)
□ No mass assignment (binding req.body directly to ORM model)
□ No eval(), no unsafe deserialization, no SSRF-prone URLs from user input
```

### Tier 3: Concurrency & Idempotency (CRITICAL)

**Source: Google eng-practices, Stripe idempotency, Java concurrency checklist.**

```
□ No race conditions on shared mutable state
  → Two requests read-modify-write same row → lost update
  → Fix: SELECT ... FOR UPDATE, optimistic locking (version column), or atomic UPDATE

□ No deadlock potential
  → Nested transactions or locking resources in different orders = production freeze
  → Fix: consistent lock ordering, reduce transaction scope, use timeouts

□ Atomic operations for counters and balances
  → ⛔ bad:  balance = getBalance(); balance -= amount; setBalance(balance);
  → ✅ good: UPDATE accounts SET balance = balance - :amount WHERE id = :id

□ Thread-safety of singletons
  → NestJS/Spring services are singletons by default
  → Storing request-scoped state on `this` causes cross-request data leaks
  → Use request-scoped providers or pass state via parameters

□ Idempotency on write endpoints
  → If payment endpoint called twice (network retry), does it charge twice?
  → Fix: idempotency key in header, check for duplicate before processing
  → Applies to: payments, order creation, email sending, any side effect

□ No check-then-act without transaction (TOCTOU)
  → ⛔ bad:  if (!exists(email)) { create(email) } → race: two requests both pass check
  → ✅ good: INSERT ... ON CONFLICT DO NOTHING, or wrap in transaction with lock
```

### Tier 4: Database & Performance (HIGH)
```
□ No N+1 queries (use joins/eager loading/DataLoader)
□ Indexes exist for WHERE/ORDER BY columns
□ Transactions for multi-step DB operations
□ LIMIT on all list queries (no unbounded SELECT)
□ Connection pool configured (not creating connections per request)
□ Migrations are reversible (up AND down)
□ No expensive operations in request path (offload to queue)
□ No full table scans on large tables
□ Pagination implemented for list endpoints (cursor-based or offset)
```

### Tier 5: Caching Correctness (HIGH)

**Source: Facebook cache-made-consistent, Redis best practices.**

```
□ Cache invalidation strategy defined
  → Code writes to DB but doesn't invalidate cache → stale data served
  → Pattern: write-through, write-behind, or cache-aside with explicit invalidation

□ Cache key design includes ALL relevant parameters
  → ⛔ bad:  cache key = "user:${userId}" → serves English data to French users
  → ✅ good: cache key = "user:${userId}:${locale}:${version}"

□ TTL set appropriately
  → Infinite TTL = stale data forever. Zero TTL = no caching benefit
  → TTL should match data volatility (user profile: 5min, config: 1hr, static: 24hr)

□ Cache stampede / thundering herd protection
  → Popular key expires → 1000 requests simultaneously hit DB
  → Fix: mutex/lock, stale-while-revalidate, or probabilistic early expiration

□ No caching of user-specific data in shared cache without proper key isolation
  → User A's data served to User B = security vulnerability
```

### Tier 6: Resource Management (HIGH)

**Source: SonarQube resource leak rules, production OOM post-mortems.**

```
□ File handles / streams closed after use
  → Use try-with-resources (Java), with (Python), using (C#), finally (Node.js)
  → Leaked handles = OS file descriptor exhaustion → process crash

□ Database connections returned to pool
  → A single leaked connection cascades into complete service failure under load
  → Always use connection pool's acquire/release pattern, never manual open/close

□ Event listeners / subscriptions cleaned up
  → Node.js: listeners added without removeListener on cleanup = memory leak
  → WebSocket: connections not cleaned up on disconnect

□ Unbounded in-memory collections
  → Growing Map/Array without size limit (e.g., caching in Map without eviction)
  → Fix: LRU cache with maxSize, or use external cache (Redis)

□ Spawned processes / child workers terminated
  → child_process.exec() without cleanup on parent exit = zombie processes

□ setTimeout/setInterval cleared on teardown
  → Especially in NestJS modules, Express middleware, React SSR
```

### Tier 7: Error Handling (HIGH)
```
□ All async operations have error handling
□ No empty catch blocks
□ Errors logged with context (request ID, user ID, operation)
□ User-facing errors are sanitized (no stack traces in production)
□ Global exception handler exists and covers this code
□ Proper HTTP status codes (not 200 for everything)
□ Consistent error response format across all endpoints
□ Retries for external API calls have exponential backoff + max attempts
□ Graceful degradation when external service is down (circuit breaker pattern)
```

### Tier 8: Backward Compatibility & API Evolution (HIGH)

**Source: Google AIP-180, Stripe API versioning, mobile client compatibility.**

```
□ No removed/renamed fields in response without version bump
  → Mobile clients on old app versions still send requests with old field names
  → Fix: add new field, deprecate old, remove only in next major version

□ No changed field types (string→number, nullable→required)
  → Frontend doing parseInt(response.price) breaks if price changes from string to number

□ No changed enum values without default handling
  → Adding new enum value breaks clients' switch/case without default case
  → Fix: always document new values, clients must have default/unknown handler

□ No changed error response shapes
  → { error: "msg" } → { errors: ["msg"] } breaks every client's error handler

□ Database migration backward compatible with current running version
  → ⛔ bad:  rename column in migration → current code crashes during deploy
  → ✅ good: 1) add new column → 2) deploy code using both → 3) migrate data → 4) remove old

□ Deprecated endpoints have sunset timeline
  → Not just @deprecated tag — WHEN will it be removed? What's the replacement?
```

### Tier 9: Cross-Module Impact (HIGH)
```
□ Changes in shared code: WHO ELSE uses this? (Grep for imports/references)
□ Changed interface/DTO: all callers updated?
□ Changed database schema: all queries still valid?
□ Changed environment variable: all deploy configs updated?
□ Changed middleware: does it affect other routes unintentionally?
□ Changed base class/parent: all children still work?
□ Changed response shape: frontend/clients notified?
□ Added new dependency: does it conflict with existing packages?
  → Check for: version conflicts, duplicate packages, native modules
```

### Tier 10: Observability & Production Readiness (MEDIUM)

**Source: SRE practices from Google, Netflix, Uber.**

```
□ Structured logging on key operations (not just errors)
  → Request received, processing started, external call made, completed
  → With correlation/request ID for tracing across services

□ Metrics instrumented for new endpoints
  → RED metrics: Rate (requests/sec), Errors (error rate), Duration (latency)
  → Business metrics: orders created, payments processed, users registered

□ Health check endpoint covers new dependencies
  → New Redis connection? New external API? → add to /health/ready check

□ Distributed tracing context propagated
  → If microservices: trace headers (X-Request-ID, traceparent) passed through

□ Alert rules defined for critical paths
  → Payment endpoint without alerting = silent failures in production
```

### Tier 11: Data Privacy & Compliance (MEDIUM)

**Source: GDPR requirements, PII compliance checklists.**

```
□ No PII in logs, error messages, or analytics
  → PII = name, email, phone, IP address, device ID, location — NOT just password/token
  → Fix: mask PII in logs: "user@***.com", "192.168.***"

□ API responses don't over-fetch PII
  → List endpoints returning full user objects (including email, phone) to other users
  → Fix: separate internal vs public DTOs, return only what client needs

□ User data deletable (right to be forgotten)
  → If storing new user data, is it included in the account deletion flow?
  → Soft delete must also anonymize PII fields

□ Character encoding handles all Unicode
  → Database columns need utf8mb4 (not utf8) for emoji and CJK characters
  → Vietnamese, Chinese, Arabic, emoji must not cause errors or corruption
```

### Tier 12: Testing (MEDIUM)
```
□ Unit tests for business logic (new code has tests)
□ Integration tests for API endpoints
□ Edge cases covered: empty input, max length, invalid types, null, undefined
□ Real-world scenarios covered:
  - Concurrent users hitting same endpoint
  - Empty database (first user, first record)
  - Expired tokens / revoked permissions
  - Network failure to external service
  - Large payload / file upload limits
□ No test pollution (tests clean up after themselves)
□ Mocks only for external services (not for internal logic)
□ Test uses correct assertions (not just "no error thrown")
□ Idempotency tested (same request twice → same result, no side effects)
```

---

## Auto-Fail Patterns

**Any of these = BLOCK the PR:**

```
❌ Hardcoded secret (API key, password, token in source code)
❌ Raw SQL with string concatenation (SQL injection risk)
❌ Missing auth on protected endpoint
❌ No input validation on user-facing endpoint
❌ Empty catch block that swallows errors silently
❌ N+1 query in a loop (will kill performance at scale)
❌ Returning 200 OK for error responses
❌ Using a library function that doesn't exist in installed version
❌ Importing a package that isn't in dependencies
❌ Breaking change to public API without version bump
❌ Race condition on financial data (balance, inventory, payments)
❌ Cache serving User A's data to User B
❌ PII logged in plaintext (email, phone, name, IP)
```

---

## Deployment Safety Check

**For PRs that will be deployed (not just code review):**

```
□ Feature flag for risky changes
  → Large features without feature flags require full rollback (redeploy) if broken
  → With flags: toggle off in seconds, no redeploy needed

□ Rollback safety
  → Can this change be rolled back without data loss?
  → If migration adds NOT NULL column → rollback deletes data
  → Fix: make column nullable first, backfill, then add constraint

□ Migration ordering vs code deploy
  → Does migration need to run BEFORE or AFTER code deploy?
  → Getting this wrong = minutes of 500 errors during deploy

□ Configuration changes reviewed
  → Env var changes, infra-as-code changes often skip review but cause most outages
  → New env var → documented in README/deploy guide?

□ Gradual rollout capability
  → Can this be deployed to 1% of users first? (canary, feature flag, blue-green)
  → If not: blast radius = 100% on day one
```

---

## Review Output Format

**Every code review MUST produce a structured report:**

```
## Code Review Report

**Files reviewed:** [list of files with paths]
**PR size:** [N lines changed — flag if >400]
**Tiers completed:** 0-12 (all relevant)

### CRITICAL Issues (must fix before merge)
1. **[Tier 0 — Phantom API]** `orders.service.ts:42`
   `prisma.order.findUnique()` — findUnique() was renamed from findOne() in Prisma 3.
   This project uses Prisma 2.x (from package.json).
   → **Fix:** Change to `prisma.order.findOne()`

2. **[Tier 3 — Race Condition]** `payments.service.ts:67`
   Balance read-modify-write without lock. Two concurrent payments can overdraw.
   → **Fix:** Use `UPDATE ... SET balance = balance - :amount WHERE balance >= :amount`

### HIGH Issues (should fix before merge)
3. **[Tier 4 — Performance]** `products.service.ts:55`
   N+1 query: fetching categories inside a loop.
   → **Fix:** Use `include: { category: true }` in the main query

### MEDIUM Issues (fix or document as tech debt)
4. ...

### LOW Issues (nice to fix, non-blocking)
5. ...

### Clean Areas
✅ Error handling — consistent across all endpoints
✅ Database transactions — used correctly in payment flow
✅ Auth — all protected routes have guards

**Overall: [APPROVE / REQUEST CHANGES / BLOCK]**
  APPROVE         = 0 critical, 0 high
  REQUEST CHANGES = 0 critical, 1+ high
  BLOCK           = 1+ critical
```

---

## Severity Levels

```
CRITICAL  → Security vulnerability, data loss, phantom API, race condition on money,
            broken dependency, PII leak
            → MUST fix before merge

HIGH      → Performance issue, missing error handling, cross-module breakage,
            cache correctness, resource leak, backward incompatibility
            → SHOULD fix before merge

MEDIUM    → Code quality, testing gap, deprecated API (works but will break later),
            observability gap, privacy concern
            → FIX or document as tech debt

LOW       → Style, naming, minor improvement suggestion
            → NICE to fix, non-blocking
```

---

## Per-Language Traps

**PLATFORM FOCUS: Read ONLY the section matching the detected language.**
```
⛔ DO NOT read all 6 sections — only the one that matches the project
⛔ NestJS project → read "Node.js / TypeScript" ONLY → skip Python, Java, PHP, Go, Rust
⛔ Django project → read "Python" ONLY → skip all others
✅ Cross-platform exception: only when bug spans 2 services in different languages
```

### Node.js / TypeScript
```
PHANTOM API TRAPS:
  □ Prisma: findUnique (v3+) vs findOne (v2) — renamed
  □ Prisma: createMany not available in SQLite adapter
  □ NestJS: @nestjs/mapped-types vs @nestjs/swagger (PartialType from wrong package)
  □ Express: req.query values are ALWAYS strings (not numbers)
  □ Mongoose: Model.findById() returns null (not throw) when not found
  □ Sequelize v5→v6: findOne({ where }) changed return type
  □ Next.js: next/headers only works in App Router (not Pages Router)
  □ TypeORM: Repository.findOne() v0.2 vs v0.3 — API completely changed

CONCURRENCY TRAPS:
  □ NestJS services are singletons — storing state on `this` leaks between requests
  □ Event loop blocking: crypto.pbkdf2Sync, fs.readFileSync in request handler
  □ Promise.all vs Promise.allSettled — all() rejects on first failure, may leave work half-done
  □ Shared module-level variables mutated across requests (module cache is singleton)

RESOURCE TRAPS:
  □ Readable streams not destroyed on error → file descriptor leak
  □ setInterval in module scope without clearInterval on shutdown
  □ EventEmitter listeners added per-request without removeListener
  □ child_process.exec() without kill() on timeout → zombie processes
```

### Python (Django / FastAPI / Flask)
```
PHANTOM API TRAPS:
  □ Pydantic v1→v2: BaseModel.dict() → model_dump(), .json() → model_dump_json()
  □ FastAPI: Depends() scoping — function vs class dependency different lifecycle
  □ Django: QuerySet is LAZY — .filter().count() executes 2 queries, not 1
  □ SQLAlchemy 1.x→2.0: session.query() → select() statement style
  □ Flask: g object is request-scoped but module-level is app-scoped
  □ celery: task.delay() vs task.apply_async() — different retry behavior

CONCURRENCY TRAPS:
  □ GIL blocks CPU-bound tasks — use ProcessPoolExecutor, not ThreadPoolExecutor
  □ Django ORM is NOT thread-safe — each thread needs its own connection
  □ asyncio: mixing sync and async code — sync call in async function blocks event loop
  □ FastAPI: sync def endpoint blocks the entire event loop (use async def)
  □ SQLAlchemy session: sharing session across threads → DetachedInstanceError

RESOURCE TRAPS:
  □ SQLAlchemy session not closed → connection pool exhaustion
  □ File opened without `with` statement → leaked file descriptor
  □ Django QuerySet evaluated multiple times (each access hits DB)
  □ Large queryset loaded into memory: Model.objects.all() → use iterator()
```

### Java / Spring Boot
```
PHANTOM API TRAPS:
  □ Spring Boot 2→3: javax.* → jakarta.* package rename (ALL imports break)
  □ Spring Data JPA: findById() returns Optional<T> (not T) since Spring 2.x
  □ Jackson: @JsonProperty required for constructor params in records
  □ Hibernate: @GeneratedValue strategy changes between versions
  □ Spring Security 5→6: SecurityFilterChain replaces WebSecurityConfigurerAdapter

CONCURRENCY TRAPS:
  □ @Transactional on private method → does nothing (proxy-based AOP)
  □ @Transactional propagation: REQUIRES_NEW creates new tx, REQUIRED joins existing
  □ @Async without @EnableAsync → runs synchronously (no error thrown)
  □ Spring singleton bean with mutable instance fields → thread-unsafe
  □ LazyInitializationException: accessing lazy collection outside transaction

RESOURCE TRAPS:
  □ JPA EntityManager not closed → connection leak
  □ InputStream from HTTP response not closed → socket leak
  □ @Scheduled without thread pool config → single-threaded, tasks queue up
  □ Spring @EventListener: sync by default — slow listener blocks publisher
```

### PHP / Laravel
```
PHANTOM API TRAPS:
  □ Laravel 10→11: many facades moved or renamed
  □ Eloquent: firstOrCreate() vs firstOrNew() — one persists, one doesn't
  □ Carbon: diffInDays() returns absolute value — sign lost
  □ Laravel Queue: Job class must be serializable — closures don't work

CONCURRENCY TRAPS:
  □ PHP is shared-nothing per-request BUT: file locks, cache locks, DB locks still matter
  □ Laravel Cache::lock() — forgetting to release → deadlock
  □ Queue jobs: same job dispatched twice → runs twice (no built-in idempotency)
  □ Eloquent: increment()/decrement() is atomic, but read-modify-save is not

RESOURCE TRAPS:
  □ Eloquent lazy loading N+1: $orders->each(fn($o) => $o->user) → use with('user')
  □ Queue job serializing full Eloquent model → stale data when job runs later
  □ Blade: {!! $html !!} disables escaping → XSS if user-controlled
  □ Long-running artisan commands: DB connection drops (set reconnect config)
```

### Go
```
PHANTOM API TRAPS:
  □ Go module version mismatch: v2+ requires /v2 in import path
  □ GORM v1→v2: completely different API (gorm.io/gorm vs github.com/jinzhu/gorm)
  □ gin.Context: c.JSON() does NOT return — code after it still executes
  □ sql.DB is NOT a single connection — it's a pool (common misconception)

CONCURRENCY TRAPS:
  □ Goroutine leak: goroutine started but channel never closed → hangs forever
  □ Channel deadlock: send to unbuffered channel with no receiver
  □ Map not thread-safe: concurrent read/write to map → runtime panic
    → Fix: sync.RWMutex or sync.Map
  □ defer in loop: resources not released until function returns (not loop iteration)
  □ Context cancellation not checked: long operation ignores ctx.Done()

RESOURCE TRAPS:
  □ http.Response.Body not closed → connection pool leak
    → Always: defer resp.Body.Close()
  □ sql.Rows not closed → connection leak
    → Always: defer rows.Close()
  □ nil interface vs nil pointer: interface holding typed nil ≠ nil
    → `var err error = (*MyError)(nil)` → `err != nil` is TRUE
```

### Rust
```
PHANTOM API TRAPS:
  □ tokio vs async-std: incompatible runtimes — can't mix
  □ serde: Deserialize derive requires matching field names or #[serde(rename)]
  □ axum: Handler type signatures are strict — wrong param order = compile error
  □ sqlx: compile-time query checking requires DATABASE_URL at build time

CONCURRENCY TRAPS:
  □ Mutex held across .await → deadlock (use tokio::sync::Mutex, not std::sync::Mutex)
  □ Arc<Mutex<T>> instead of channel — often sign of wrong concurrency pattern
  □ Spawned tasks not joined → may be cancelled on runtime shutdown

RESOURCE TRAPS:
  □ Compiler catches most ownership issues BUT: leaked file handles via mem::forget
  □ Connection pool (deadpool/bb8): pool exhaustion if connections not returned
```

---

## Quick Verification Commands

```
LANGUAGE    COMMAND TO CHECK INSTALLED VERSION
──────────────────────────────────────────────
Node.js     npm ls [package]  OR  cat node_modules/[package]/package.json | grep version
Python      pip show [package]  OR  pip freeze | grep [package]
Java        mvn dependency:tree | grep [artifact]
PHP         composer show [package]
Go          go list -m [module]
Rust        cargo tree -p [crate]

LANGUAGE    COMMAND TO CHECK IF FUNCTION EXISTS
──────────────────────────────────────────────
Node.js     grep -r "functionName" node_modules/[package]/dist/
TypeScript  grep -r "functionName" node_modules/@types/[package]/
Python      python -c "from [package] import [function]; print('exists')"
Java        Check IDE autocomplete or javadoc for the class
PHP         php -r "var_dump(method_exists([class], '[method]'));"
Go          go doc [package].[Function]
```
