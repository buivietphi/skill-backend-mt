# Backend Bug Detection — Auto Scanner

> Run this scanner when reviewing code or debugging issues.

---

## Triage Protocol

**FIRST STEP for ALL bug/issue requests. Classify BEFORE choosing a workflow.**

```
STEP 1 — WHAT DID THE USER PROVIDE?

  A) Error log / stack trace       → go to Log Analysis Protocol
  B) Issue ticket / bug report     → go to Check Issue Workflow
  C) Specific bug description      → go to Find File from Description
     "API returns 500 on orders"
  D) Vague description             → STAY HERE (triage needed)
     "something is off with payments"
     "check the order module for me"
     "this endpoint feels slow"
  E) Code paste (no description)   → STAY HERE (triage needed)
     user pastes code + "xem thử" / "check this" / "is this OK?"
  F) Just a module/feature name    → STAY HERE (triage needed)
     "check the auth flow" / "look at notification service"

STEP 2 — GATHER CONTEXT (for D, E, F only)

  Ask yourself (do NOT ask user yet):
    □ What module/feature is this about?  → extract noun → Grep in project
    □ Is there a specific endpoint?        → find route in controller/
    □ Is user reporting a symptom?         → "slow", "wrong", "broken", "weird"
    □ Or just asking for general review?   → "check", "look at", "how is this"

  If user gave code:
    → Read the code → run Auto-Scan Categories (bottom of this file) against it
    → Check for: null risks, missing validation, N+1, security, missing error handling

  If user gave module/feature name:
    → Glob **/{name}/** → find related files
    → Read controller + service → run Auto-Scan Categories

  If user gave endpoint:
    → Grep route path → read controller → trace to service → scan

STEP 3 — CLASSIFY WHAT YOU FOUND

  After scanning, classify into ONE:
    □ BUG found         → report it, suggest fix (Investigate Workflow)
    □ PERFORMANCE issue → report it (Performance Bug Debug Protocol)
    □ SECURITY risk     → report it immediately (flag severity)
    □ CODE SMELL        → report it but lower priority
    □ NOTHING found     → tell user "I scanned X files, no issues found"

STEP 4 — RESPOND (triage = investigate mode)

  "I looked at [module/code/endpoint]. Here's what I found:

   **Scanned:** [N files, which areas]
   **Issues found:** [list with severity]
   **No issues in:** [areas that look clean]

   [If issues found]: Want me to fix these?
   [If nothing found]: Everything looks clean. Anything specific you're concerned about?"

⛔ Triage mode = NEVER auto-fix
⛔ NEVER say "looks fine" without actually scanning
✅ Always report WHAT you scanned and HOW MANY files
✅ Always run Auto-Scan Categories against target code
```

---

## Health Check Protocol

**When user asks to "check" a module/endpoint/service without reporting any problem.**

```
TRIGGER: "check X for me", "how is X looking", "review the Y module",
         "scan Z service", "is X OK?" — no error, no bug, just a checkup

STEP 1 — LOCATE THE TARGET
  Module name → Glob **/{module}/**
  Endpoint    → Grep route path → find controller + service + repository
  Service     → Glob **/{service}.service.* or **/{service}Service.*
  "Everything"→ Read project structure → pick critical modules (auth, payments, core)

STEP 2 — QUICK SCAN (run ALL checklists against target)
  □ Crash Risks        (Auto-Scan Category 1)
  □ Memory Leaks       (Auto-Scan Category 2)
  □ Race Conditions    (Auto-Scan Category 3)
  □ Security           (Auto-Scan Category 4)
  □ Performance        (Auto-Scan Category 5)
  □ Data Integrity     (Auto-Scan Category 6)

STEP 3 — REPORT CARD
  "Health check for [module]:

   ✅ No crash risks
   ⚠️  1 potential N+1 query in findAllWithOrders() — [file:line]
   ❌ Missing input validation on updateUser DTO — [file:line]
   ✅ Auth guards in place
   ✅ Transactions used correctly

   **Overall: [healthy / needs attention / critical issues]**
   Want me to fix the issues found?"

SCOPE CONTROL:
  - Module check    → scan 3-10 files (controller + service + repository + DTOs)
  - Endpoint check  → scan 2-5 files (route → controller → service)
  - Full service    → scan up to 20 files (limit scope, report progress)
  ⛔ NEVER scan entire project unless explicitly asked
```

---

## Log Analysis Protocol

**When user pastes a log or error message, follow this EXACT sequence.**

```
STEP 1 — PARSE THE LOG (per-runtime)
  Extract:
    - Error type/class:   TypeError, NullPointerException, 500 Internal...
    - Error message:      "Cannot read property 'id' of undefined"
    - File + line:        at UserService.findOne (users.service.ts:42)
    - Stack trace:        top 3-5 frames (filter noise — see per-runtime rules below)
    - Request context:    method, URL, user ID, request ID (if in log)
    - Timestamp + freq:   once? repeated? every N seconds?

  STACK TRACE FORMAT PER RUNTIME:
    Node.js/TS:  "at FunctionName (file.ts:line:col)" — read TOP-DOWN, first app frame is key
    Python:      "File \"file.py\", line N, in func" — read BOTTOM-UP, last frame is key
    Java:        "at com.pkg.Class.method(File.java:N)" — read TOP-DOWN, first non-framework
    PHP:         "#0 /path/file.php(N): func()" — read TOP-DOWN, numbered frames
    Go:          "goroutine N [...]: pkg.Func(file.go:N)" — check goroutine + first app frame

  NOISE FILTERING — SKIP these lines:
    Node.js:  node:internal/*, node_modules/*, processTicksAndRejections, __awaiter
    Python:   site-packages/*, /usr/lib/python*, importlib._bootstrap*
    Java:     sun.reflect.*, java.lang.reflect.*, org.springframework.cglib.*
    PHP:      vendor/*, Illuminate\Pipeline\*, Illuminate\Routing\*
    Go:       runtime/*, runtime.goexit, runtime.main
    General:  framework middleware stack, HTTP server internals, event loop frames

  → KEEP: app source frames (src/, app/, lib/, internal/, pkg/)

STEP 2 — CLASSIFY THE BUG
  □ Crash (app stops)           → fix immediately, likely null/undefined/exception
  □ Logic error (wrong result)  → trace data flow, compare expected vs actual
  □ Performance (slow)          → profile, check DB queries, external calls
  □ Intermittent (sometimes)    → race condition, concurrency, external dependency
  □ Data corruption             → missing transaction, parallel writes
  □ Security incident           → auth bypass, injection, data leak

STEP 3 — LOCATE THE ROOT CAUSE (not the symptom)
  Read file:line from stack trace → trace BACKWARDS:
    Error at line 42 → what called line 42? → what data was passed?
    → Where does that data come from? → THAT is likely the root cause.

  Ask: "If I fix line 42, will this bug happen again with different input?"
    YES → you're fixing a symptom, dig deeper
    NO  → you found the root cause

STEP 4 — FIX + PREVENT
  1. Write the fix
  2. Add a test that REPRODUCES the bug (red) → verify fix makes it pass (green)
  3. Ask: "Should I add a guard/validation to prevent this class of bug?"
     If yes → add input validation, null check, or constraint

HARD GATE:
  ⛔ CANNOT propose a fix if Steps 1-3 are not completed
  ⛔ CANNOT skip straight to "try this fix" without tracing root cause
  ⛔ If you catch yourself guessing → STOP → go back to Step 1

ANTI-RATIONALIZATION (debug-specific):
  □ "I found the bug" — DID YOU? Or did you find A bug that isn't THE bug?
    → Verify: does fixing it make the ORIGINAL error disappear? Run it.

  □ "This fix should work" — PROVE IT. Run the reproduction test.
    → "Should" = haven't tested. Replace "should" with "I ran X and got Y".

  □ Evidence contradicts your hypothesis?
    → UPDATE the hypothesis. Don't explain away the evidence.
    → "The test passes locally but fails in CI" ≠ "CI is wrong"
       = your code has an env-dependent bug.

  □ First theory feels right?
    → STILL check one alternative. Confirmation bias is strongest
       when the first answer "feels obvious".

  □ Already wrote 30+ lines of fix and it's not working?
    → STOP. Delete the fix. Re-read the error from scratch.
    → Fresh eyes > sunk cost. A wrong fix that's long is still wrong.

  □ About to modify a test to make your fix pass?
    → ⛔ STOP. The test is the spec. Your code must match the spec.
    → Only modify test if: test itself has a verifiable bug (cite evidence).
```

---

## Reproduction Protocol

**BEFORE fixing, reproduce the bug. Never fix blind.**

```
STEP 1: ISOLATE — Which layer is broken?
  Client → API Gateway → Controller → Service → Repository → Database → External API
                    ↑ check logs at each layer boundary

  Quick isolation:
    - Add log at controller entry → does request arrive?
    - Add log at service entry → does service receive correct params?
    - Check DB query → does query return expected data?
    - Check external API → does it respond correctly?

STEP 2: REPRODUCE — Create minimal test case (priority order)
  1st: Failing unit test        → fastest, most reliable, becomes regression guard
  2nd: Integration test         → if bug spans multiple layers (service + DB)
  3rd: curl / HTTP client       → if unit test can't reach the bug
  4th: Loop 50x                 → if intermittent (race condition, timing)
  5th: Manual steps (last resort) → document exact steps for user to verify

  Include:
    - Same input data
    - Same state (DB records, cache state)
    - Same sequence (if race condition: parallel requests)

  If can't reproduce → it's likely:
    - Environment-specific (check env vars, config diff)
    - Timing-dependent (race condition, timeout)
    - Data-dependent (specific record triggers edge case)

STEP 3: FIX — Then verify with the test
  Test should FAIL before fix → PASS after fix.
  This test becomes a regression guard forever.

CONTEXT PROTECTION:
  ⛔ NEVER dump raw 100+ line logs into response — summarize key frames only
  ✅ Route verbose output to temp file → query with Grep for relevant lines
  ✅ Show user: error type + file:line + root cause — not entire stack trace
  ✅ If log is massive → extract top 3-5 app frames → discard noise
```

---

## Root Cause vs Symptom

```
SYMPTOM FIX (bad):                    ROOT CAUSE FIX (good):
  try { } catch { return null; }        Validate input BEFORE it reaches this code
  if (!user) user = {};                 Fix the query that should always return user
  setTimeout(retry, 1000);             Fix the race condition causing the failure
  .toString() || 'fallback';           Ensure the field is never null from source

RULE: If your fix contains a fallback/default → you might be fixing a symptom.
RULE: If your fix adds validation at the SOURCE → you're fixing root cause.
RULE: Every fix MUST include: "Root cause: [X]. Prevented by: [Y]."
```

---

## Error Type → Search Strategy

**Map the error to WHERE to search first. Don't search everything.**

```
ERROR TYPE                    SEARCH STRATEGY
──────────────────────────────────────────────────────────────
500 Internal Server Error     → Search service/ layer (business logic crash)
                                Grep error message in source, check unhandled exceptions

404 Not Found                 → Search route/controller config FIRST
                                Check: route registered? path params correct? middleware blocking?

401/403 Auth Error            → Search auth middleware, guard, JWT config
                                Check: token valid? role/permission correct? middleware order?

400 Validation Error          → Search DTO/schema/validator
                                Check: which field failed? type mismatch? missing required?

409 Conflict                  → Search unique constraints, upsert logic
                                Check: duplicate key? race condition on insert?

DB Connection Error           → Search config (.env, ormconfig, database.yml) NOT source
                                Check: host/port/credentials, pool settings, SSL config

Build/Compile Error           → Search config (tsconfig, pom.xml, pyproject.toml) FIRST
                                Then: check import paths, type definitions, dependency versions

Migration Error               → Search migration files (NOT source code)
                                Check: SQL syntax, column types, constraint conflicts

Timeout / Slow Response       → Search external API calls, complex DB queries
                                Read: shared/performance-optimization.md

Memory/OOM Error              → Search for: unbounded arrays, missing pagination, event listeners
                                Read: shared/error-recovery.md (Memory section)
```

---

## Investigate Workflow

**When user wants to UNDERSTAND a bug, not fix it yet.**

```
TRIGGER: User says "check", "investigate", "look into", "why is X happening",
         "can you find out", "what's causing" — WITHOUT saying "fix" or "solve"

FLOW (investigate ≠ fix):
  1. REPRODUCE the issue (or confirm from logs)
  2. TRACE the data flow — show the user what happens step by step
  3. IDENTIFY the root cause — explain WHY it happens
  4. PRESENT options — "Here are 3 ways to fix this: [A, B, C]"
  5. WAIT for user decision — do NOT auto-fix

OUTPUT FORMAT:
  "I investigated the issue. Here's what I found:

   **What happens:**
   [step-by-step trace of the bug]

   **Root cause:**
   [why this happens]

   **Recommended fixes:**
   1. [option A] — [trade-off]
   2. [option B] — [trade-off]

   Which approach do you prefer?"

⛔ NEVER auto-fix during investigate mode
⛔ NEVER skip presenting options
✅ Always trace the full path before concluding
```

---

## Find File from Description

**When user describes a bug in words without file names or stack traces.**

```
USER SAYS                     SEARCH STRATEGY
──────────────────────────────────────────────────────────────
"orders API returns wrong X"  → Grep -i "order" in controller/ → find route
                                → Read controller → find service method → trace logic

"user login is broken"        → Grep "login\|signin\|authenticate" in controller/ + service/
                                → Check auth middleware → check user entity/model

"payment webhook fails"       → Grep "webhook\|stripe\|payment" in controller/ + service/
                                → Check route registration → check handler logic

"email not sending"           → Grep "mail\|email\|smtp\|sendgrid" across project
                                → Check queue/job if async → check config/credentials

GENERAL STRATEGY (when keyword is unclear):
  1. Extract NOUNS from description: "profile", "order", "payment", "notification"
  2. Grep noun (case-insensitive) in controller/ or routes/ → find the entry point
  3. Read controller → find service call → read service → find repository/query
  4. Trace DOWN the call chain until you find the logic that matches the bug

SEARCH ORDER:
  controller/ → service/ → repository/ → entity/ → config/

MULTI-MATCH? (Grep returns 20+ files)
  → Add context: Grep "order" --glob "*controller*" or --glob "*service*"
  → Narrow by HTTP method: Grep "GET.*order\|order.*GET" for read issues
```

---

## Check Issue Workflow

**When user says "check issue #123" or pastes issue content from Jira/GitHub/Linear.**

```
TRIGGER: "check issue", "look at this ticket", "investigate this bug report",
         user pastes issue/ticket content

STEP 1 — PARSE THE ISSUE
  Extract from issue content:
    - Title:              short summary
    - Steps to reproduce: input + actions + expected vs actual
    - Affected area:      which feature/module/endpoint
    - Severity:           crash? wrong data? cosmetic? performance?
    - Environment:        production? staging? local? specific OS/version?
    - Attachments:        error logs, screenshots, request/response dumps

STEP 2 — MAP TO CODEBASE
  From "affected area", find the code:
    - Endpoint mentioned?   → Grep route path in controller/routes
    - Module mentioned?     → Glob **/{module}/**
    - Error log attached?   → Parse with Log Analysis Protocol (above)
    - No clear pointer?     → Use Find File from Description (above)

STEP 3 — ASSESS
  Can you reproduce from the steps?
    YES → run Reproduction Protocol → trace → find root cause
    NO  → ask user for: missing env info, test data, exact request payload

STEP 4 — RESPOND (investigate mode, NOT auto-fix)
  "I checked issue #123. Here's what I found:

   **Affected code:** [file:line]
   **Root cause:** [explanation]
   **Reproduction:** [confirmed / needs more info]
   **Suggested fix:** [approach]

   Want me to fix it?"

NOTE: "check issue" = investigate mode by default.
      Only fix if user explicitly says "fix issue #123".
```

---

## Auto-Scan Categories

### 1. Crash Risks
```
□ Unhandled promise rejections / uncaught exceptions
□ Null pointer on optional chaining (?.property on undefined)
□ Division by zero without guard
□ Array index out of bounds
□ Missing null checks on database query results
□ Parsing user input without try/catch (JSON.parse, parseInt)
```

### 2. Memory & Connection Leaks
```
□ Database connections not released back to pool
□ File handles not closed (streams, file descriptors)
□ Event listeners added without cleanup
□ Unbounded in-memory caches (no TTL, no max size)
□ Large objects retained in closures
□ Spawned child processes not terminated
```

### 3. Race Conditions
```
□ Concurrent writes to same database row (no optimistic locking)
□ Check-then-act without transaction (TOCTOU)
□ Shared mutable state between requests (module-level variables)
□ Multiple workers modifying same resource
□ Missing mutex/lock on critical sections
```

### 4. Security Vulnerabilities
```
□ SQL injection (string concat in queries)
□ XSS (unescaped output in HTML/templates)
□ CSRF (missing tokens on state-changing endpoints)
□ SSRF (unvalidated URLs in server-side requests)
□ Mass assignment (binding request body directly to model)
□ Path traversal (user input in file paths)
□ Auth bypass (missing middleware on routes)
□ Secrets in source code or logs
```

### 5. Performance Issues
```
□ N+1 queries (query in a loop)
□ Missing database indexes
□ Unbounded queries (no LIMIT/pagination)
□ Synchronous I/O blocking event loop (Node.js)
□ Missing caching for expensive/repeated queries
□ Large payloads without compression
□ Missing connection pooling
```

### 6. Data Integrity
```
□ Missing database transactions for multi-step operations
□ No foreign key constraints
□ Inconsistent data types between API and database
□ Missing unique constraints where needed
□ Soft delete without filtering in queries
□ Timezone mismatches (server vs database vs client)
```

### 7. Per-Language Bug Patterns

**PLATFORM FOCUS: Scan ONLY the section matching the detected language.**
```
⛔ DO NOT scan all languages — only the one detected from the project
⛔ NestJS project → scan "Node.js / TypeScript" ONLY
⛔ Spring project → scan "Java / Spring" ONLY
✅ Cross-platform exception: only when bug spans 2 services in different languages
```

```
── Node.js / TypeScript ──
□ Unhandled promise rejection (missing .catch() or try/catch around await)
□ Event loop blocked by sync operation (fs.readFileSync, crypto.pbkdf2Sync)
□ Module-level mutable state shared between requests (singleton leak)
□ Express req.query values are strings — parseInt/Number() needed for numeric comparison
□ Prisma/TypeORM: findOne returns null — missing null check before accessing property
□ NestJS: @Injectable() singleton storing request-scoped data on `this`

── Python ──
□ Django QuerySet lazy evaluation — .filter() is deferred, calling it twice = 2 queries
□ SQLAlchemy DetachedInstanceError — accessing relation outside session scope
□ FastAPI sync def endpoint blocks async event loop — should be async def
□ GIL: CPU-bound task in request handler blocks all concurrent requests
□ Pydantic v1 vs v2 API mismatch — .dict() removed in v2, use .model_dump()
□ Mutable default argument: def func(items=[]) — shared across calls

── Java / Spring ──
□ @Transactional on private method — proxy AOP does nothing, runs without transaction
□ LazyInitializationException — accessing Hibernate lazy collection outside open session
□ @Async without @EnableAsync — runs synchronously, no error thrown
□ Spring singleton bean with mutable field — thread-unsafe under load
□ NullPointerException from Optional.get() without isPresent() check
□ Jackson circular reference — @JsonIgnore or @JsonManagedReference missing

── PHP / Laravel ──
□ Eloquent N+1: $posts->each(fn($p) => $p->author) — use with('author')
□ Queue job serializing Eloquent model — stale data when job runs minutes later
□ Blade {!! $var !!} — unescaped output = XSS if user-controlled
□ Cache::lock() without release → other processes deadlocked
□ Long-running artisan: DB connection drops — set reconnect or refresh connection

── Go ──
□ Goroutine leak: goroutine blocked on channel read, no sender, no timeout
□ Map concurrent access: two goroutines read/write same map → runtime panic
□ http.Response.Body not closed → connection pool leak (defer resp.Body.Close())
□ sql.Rows not closed after iteration → connection never returned to pool
□ defer in loop: resource cleanup deferred to function end, not loop iteration
□ nil interface trap: interface holding typed nil ≠ nil comparison
```
