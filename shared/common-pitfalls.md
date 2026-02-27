# Common Backend Pitfalls

> Known issue patterns. Match symptoms to known problems.

---

## Database Pitfalls

```
SYMPTOM: API slows down as data grows
CAUSE:   Missing indexes on frequently queried columns
FIX:     Run EXPLAIN ANALYZE, add indexes on WHERE/ORDER BY columns

SYMPTOM: Random "connection refused" errors under load
CAUSE:   Connection pool exhaustion
FIX:     Increase pool size, ensure connections are released, add health checks

SYMPTOM: Partial data saved after error
CAUSE:   Multi-step operation without transaction
FIX:     Wrap related writes in a database transaction

SYMPTOM: Duplicate records appearing
CAUSE:   Missing unique constraint + race condition
FIX:     Add unique constraint at database level (not just application)

SYMPTOM: Slow list endpoints
CAUSE:   N+1 queries (fetching relations in a loop)
FIX:     Use JOINs or eager loading (include/with/prefetch_related)

SYMPTOM: Query returns all rows (massive response)
CAUSE:   Missing LIMIT/pagination
FIX:     Always paginate list endpoints, set max page size

SYMPTOM: Deadlock errors in production
CAUSE:   Transactions locking rows in different orders
FIX:     Consistent lock ordering, reduce transaction scope

SYMPTOM: Timezone-related bugs
CAUSE:   Mixing UTC and local times
FIX:     Store everything as UTC (TIMESTAMPTZ), convert only on display
```

---

## API Pitfalls

```
SYMPTOM: Frontend getting different error formats
CAUSE:   No standardized error response
FIX:     Global exception handler with consistent { error: { code, message, details } }

SYMPTOM: Breaking clients after backend update
CAUSE:   Unversioned API changes
FIX:     API versioning (/api/v1/), never change existing contracts

SYMPTOM: 200 OK but actually an error
CAUSE:   Using 200 for all responses
FIX:     Use proper HTTP status codes (400, 401, 403, 404, 409, 500)

SYMPTOM: API endpoint unbearably slow
CAUSE:   Expensive computation in request handler
FIX:     Offload to background job, return 202 Accepted
```

---

## Security Pitfalls

```
SYMPTOM: User can access other user's data
CAUSE:   Only checking authentication, not authorization
FIX:     Check resource ownership: if (order.userId !== currentUser.id)

SYMPTOM: SQL injection vulnerability reported
CAUSE:   String concatenation in SQL queries
FIX:     Use parameterized queries / ORM methods ALWAYS

SYMPTOM: Secrets found in Git history
CAUSE:   .env file was committed at some point
FIX:     git filter-branch to remove, rotate ALL exposed secrets

SYMPTOM: CORS errors in production but not dev
CAUSE:   Wildcard CORS in dev, not configured for production domains
FIX:     Explicit allowed origins in production config

SYMPTOM: JWT token works after user logout
CAUSE:   No token blacklist/revocation
FIX:     Short-lived access tokens + refresh token rotation + blacklist
```

---

## Deployment Pitfalls

```
SYMPTOM: Works locally but fails in production
CAUSE:   Environment variable not set in production
FIX:     Validate ALL required env vars at startup (fail fast)

SYMPTOM: New deploy breaks old clients
CAUSE:   Breaking migration without backward compatibility
FIX:     Deploy in phases: 1) add new column 2) deploy code 3) migrate data 4) remove old column

SYMPTOM: Memory keeps growing, then OOM crash
CAUSE:   Memory leak (unbounded cache, event listeners, closures)
FIX:     Profile with heap snapshots, add cache TTL and max size

SYMPTOM: Intermittent 502 errors during deploy
CAUSE:   No graceful shutdown (killing connections mid-request)
FIX:     Handle SIGTERM: stop accepting new requests, finish in-flight, then exit
```

---

## Node.js Specific

```
SYMPTOM: Event loop blocked, high latency
CAUSE:   Synchronous/CPU-intensive code on main thread
FIX:     Use worker threads or offload to separate service

SYMPTOM: Unhandled promise rejection crash
CAUSE:   Missing .catch() or try/catch around await
FIX:     Global handler + add error handling to all async paths

SYMPTOM: Module not found after install
CAUSE:   Lockfile out of sync or workspace hoisting issue
FIX:     Delete node_modules + lockfile, reinstall
```

---

## Python Specific

```
SYMPTOM: Slow concurrent requests
CAUSE:   GIL blocking CPU-bound tasks
FIX:     Use async I/O (uvicorn/gunicorn), ProcessPoolExecutor for CPU

SYMPTOM: Different behavior in different environments
CAUSE:   Package version mismatch
FIX:     Pin exact versions in requirements.txt, use virtual environments
```
