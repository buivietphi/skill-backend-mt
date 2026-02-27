# Backend Error Recovery

> Common build, runtime, and deployment errors with fixes.

---

## Build Errors

### Node.js / TypeScript
```
ERROR: Cannot find module 'X'
  → npm install X  (or check import path)
  → If @types/X → npm install -D @types/X

ERROR: Type 'X' is not assignable to type 'Y'
  → Check interface/type definition
  → Verify function return types
  → Check for null/undefined (use optional chaining)

ERROR: Circular dependency detected
  → Use forwardRef() in NestJS
  → Extract shared interface to separate file
  → Restructure imports to break the cycle

ERROR: Cannot use import statement outside a module
  → Add "type": "module" to package.json
  → Or use "esModuleInterop": true in tsconfig.json
  → Check if dependency supports ESM

ERROR: ENOSPC: no space left on device (watch limit)
  → echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
  → sudo sysctl -p
```

### Python
```
ERROR: ModuleNotFoundError: No module named 'X'
  → pip install X (check requirements.txt)
  → Verify virtual environment is activated

ERROR: ImportError: attempted relative import with no known parent package
  → Run as module: python -m mypackage.module
  → Add __init__.py to directories

ERROR: sqlalchemy.exc.OperationalError: connection refused
  → Check DATABASE_URL environment variable
  → Verify database is running
  → Check host/port/credentials
```

### Java / Spring Boot
```
ERROR: BeanCreationException: Error creating bean 'X'
  → Check @Component/@Service/@Repository annotations
  → Verify constructor injection dependencies exist
  → Check for circular dependencies

ERROR: Could not find artifact X
  → Check Maven/Gradle dependency declaration
  → Run: mvn dependency:resolve or gradle dependencies
  → Verify repository URLs in pom.xml/build.gradle
```

### PHP / Laravel
```
ERROR: Class 'App\X' not found
  → composer dump-autoload
  → Check namespace matches directory structure
  → Verify PSR-4 autoloading in composer.json

ERROR: SQLSTATE[HY000] [2002] Connection refused
  → Check .env DB_HOST, DB_PORT, DB_DATABASE
  → Verify database server is running
  → php artisan config:clear
```

---

## Runtime Errors

### Database
```
ERROR: Connection pool exhausted / too many connections
  FIX: Reduce pool size, ensure connections are released
  CHECK: Are you creating connections in a loop?
  CHECK: Missing finally/using block to release connection?

ERROR: Deadlock detected
  FIX: Ensure consistent lock ordering across transactions
  FIX: Reduce transaction scope (lock less data)
  FIX: Add retry logic for deadlock errors

ERROR: Unique constraint violation
  FIX: Check for duplicates before insert (or use upsert)
  FIX: Handle error gracefully (return 409 Conflict)

ERROR: Foreign key constraint violation
  FIX: Ensure referenced record exists before insert
  FIX: Check cascade delete settings
  FIX: Delete child records before parent

ERROR: Migration failed
  FIX: Check migration SQL for syntax errors
  FIX: Verify database is in expected state
  FIX: Run migration on fresh DB to verify
  ROLLBACK: Run down migration, fix, re-run up
```

### Network
```
ERROR: ECONNREFUSED / Connection refused
  FIX: Verify target service is running
  FIX: Check host:port configuration
  FIX: Check firewall/security group rules

ERROR: ETIMEDOUT / Request timeout
  FIX: Increase timeout setting
  FIX: Check network connectivity
  FIX: Verify target service performance

ERROR: ECONNRESET / Connection reset by peer
  FIX: Target server closed connection unexpectedly
  FIX: Add retry logic with exponential backoff
  FIX: Check for server-side resource limits

ERROR: CERT_HAS_EXPIRED / SSL certificate expired
  FIX: Renew SSL certificate
  FIX: Update CA certificates bundle
  ⛔ NEVER disable SSL verification as a fix
```

### Memory
```
ERROR: JavaScript heap out of memory
  FIX: Increase: NODE_OPTIONS="--max-old-space-size=4096"
  ROOT CAUSE: Check for memory leaks (unbounded caches, event listeners)
  TOOL: node --inspect + Chrome DevTools heap snapshot

ERROR: OOMKilled (Kubernetes/Docker)
  FIX: Increase container memory limit
  ROOT CAUSE: Check for memory leaks in application
  FIX: Add memory profiling to identify leak
```

---

## Deployment Errors

```
ERROR: Port already in use
  FIX: Kill the process using the port
  FIX: Change application port
  CMD: lsof -i :3000 | grep LISTEN

ERROR: Permission denied
  FIX: Check file/directory permissions
  FIX: Don't run as root (use non-root user in Docker)
  FIX: Check if port < 1024 (requires root or capability)

ERROR: Environment variable not set
  FIX: Check .env file exists and is loaded
  FIX: Check deployment config (K8s secrets, Docker env)
  FIX: Add startup validation (fail fast if missing)

ERROR: Migration failed in production
  FIX: NEVER roll forward with a broken migration
  FIX: Run down migration to revert
  FIX: Fix migration, test on staging, re-deploy
  PREVENTION: Always test migrations on copy of production data
```

---

## Build Error Routing

**Build errors are CONFIG errors, not source errors. Search config FIRST.**

```
DECISION TREE:
  Build error? → Is it a DEPENDENCY error or a CODE error?

  DEPENDENCY ERROR (can't find module, version conflict):
    Node.js  → check package.json + package-lock.json + node_modules
    Python   → check requirements.txt / pyproject.toml + venv
    Java     → check pom.xml / build.gradle + .m2/repository
    PHP      → check composer.json + composer.lock + vendor/
    Go       → check go.mod + go.sum
    → FIX: install missing dep, resolve version conflict, clear cache + reinstall

  CODE/COMPILE ERROR (type error, syntax error, import error):
    Node.js/TS → check tsconfig.json FIRST (strict, paths, moduleResolution)
                 then: check the file:line from error
    Python     → check pyproject.toml (tool.mypy, tool.ruff) FIRST
                 then: check import paths, __init__.py
    Java       → check pom.xml (compiler plugin, Java version) FIRST
                 then: check class/interface definitions
    PHP        → check composer.json (autoload PSR-4) FIRST
                 then: check namespace vs directory structure

  CONFIG-ONLY ERROR (no source file in error):
    Docker     → check Dockerfile, docker-compose.yml, .dockerignore
    CI/CD      → check .github/workflows/, Jenkinsfile, .gitlab-ci.yml
    Database   → check .env (DB_*), ormconfig, database.yml, alembic.ini
    Infra      → check terraform/, k8s/, helm/

ROUTING RULE:
  Error mentions config file?       → fix config, NOT source
  Error mentions source file:line?  → read source, but check config FIRST (tsconfig, etc.)
  Error has no file reference?      → it's config/env → check .env, Dockerfile, CI config
```

---

## Error Recovery Protocol

```
1. READ the full error message (don't skim)
2. CLASSIFY: crash / logic / performance / intermittent / security
3. CHECK if it's a known pattern (above)
4. SEARCH project for similar error handling
5. If framework-specific → Read framework reference file
6. WebSearch: "[framework] [exact error] [year]"
7. FIX → Write regression test → Re-run → Verify
8. If same error 3 times → RULE 7: Ask user

ROLLBACK-FIRST:
  - Keep changes reversible: isolated commits, feature flags when impact unclear
  - Production bug? → rollback first, investigate second (don't debug live)
  - Uncertain fix? → ship behind disabled-by-default toggle, enable after verification
  - NEVER push a "quick fix" that skips regression test
```

---

## Multi-Service Debug Protocol

**When bug spans multiple services (microservices, external APIs).**

```
STEP 1: FIND THE CORRELATION ID
  Check logs for: requestId, correlationId, traceId, X-Request-ID
  → Use this ID to trace the request across ALL services

STEP 2: MAP THE REQUEST PATH
  Draw the flow:
    Client → API Gateway → Service A → Service B → Database
                              ↓
                          Service C → External API

  For each hop, check:
    □ Did the request arrive? (check entry log)
    □ Did it succeed? (check response log)
    □ What was the latency? (timestamp diff)
    □ What data was passed? (check request/response body in logs)

STEP 3: IDENTIFY THE FAILING HOP
  "Request succeeded at Service A but failed at Service B"
  → Bug is in Service B's handling OR in the data Service A sent

STEP 4: CHECK COMMON MULTI-SERVICE BUGS
  □ Serialization mismatch (Service A sends camelCase, B expects snake_case)
  □ Auth token not propagated (missing Authorization header forwarding)
  □ Timeout too short (Service B takes 5s but Service A timeout is 3s)
  □ Network partition (Service B is down, no circuit breaker)
  □ Data format change (Service B deployed new version, different contract)
  □ Missing retry for transient failures (503, ECONNRESET)

TOOLS:
  Distributed tracing → Jaeger, Zipkin, Datadog APM
  Log aggregation     → ELK, Loki, CloudWatch Logs Insights
  Query:              correlationId:"req_abc123" | sort timestamp
```

---

## Performance Bug Debug Protocol

**When the bug is "it's slow" — not a crash, not wrong data, just slow.**

```
STEP 1: MEASURE (don't guess)
  Where is time spent?
    □ Database queries      → Enable query logging, check slow query log
    □ External API calls    → Log response times per external service
    □ CPU computation       → Profile with flamegraph
    □ Network/serialization → Check payload sizes
    □ Queue/backpressure    → Check queue depth and consumer lag

STEP 2: READ QUERY EXECUTION PLAN
  PostgreSQL: EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...
  MySQL:      EXPLAIN FORMAT=TREE SELECT ...

  Look for:
    ❌ Seq Scan on large table (missing index)
    ❌ Nested Loop with high row count (N+1 or bad join)
    ❌ Sort on disk (missing index, increase work_mem)
    ❌ High "actual rows" vs "planned rows" (stale statistics → ANALYZE table)

STEP 3: IDENTIFY THE BOTTLENECK (one at a time)
  Rule: Fix the SLOWEST component first.
  Don't optimize code that takes 5ms when a query takes 2000ms.

  Common bottlenecks ranked:
    1. Missing DB index           → fix: CREATE INDEX CONCURRENTLY
    2. N+1 queries                → fix: eager loading / JOIN
    3. Unbounded query            → fix: add LIMIT, pagination
    4. External API slow          → fix: cache response, circuit breaker, async
    5. CPU-heavy in request path  → fix: offload to background job
    6. Large payload              → fix: pagination, sparse fields, compression

STEP 4: VERIFY IMPROVEMENT
  Before: p95 = Xms, query time = Yms
  After:  p95 = X'ms, query time = Y'ms
  Always measure BEFORE and AFTER. Never say "it's faster" without numbers.

TOOLS:
  Node.js:   clinic.js, 0x (flamegraph), --inspect + DevTools
  Python:    py-spy, cProfile, django-debug-toolbar
  Java:      async-profiler, VisualVM, Spring Actuator /metrics
  Database:  pgBadger (PostgreSQL), pt-query-digest (MySQL)
```
