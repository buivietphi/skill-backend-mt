# Prompt Engineering for Backend Development

> Smart prompting patterns for AI-assisted backend code generation.
> Learned from Anthropic, Cursor, Lovable, Manus, Windsurf, Kiro, Claude Code, and top 53k+ star repos.

---

## Auto-Think Templates

**Before ANY action, run the matching think template silently.**

### Fix / Debug
```
<think>
ERROR: [exact error message]
FILE: [file:line from stack trace]
FRAMEWORK: [NestJS / Next.js / Django / FastAPI / Spring / Laravel / Express]
BUG CLASS: [crash / logic / performance / intermittent / security / data corruption]
LAYER: [controller / service / repository / DB / external API / config]

ROOT CAUSE CANDIDATES (rank by likelihood, MUST have evidence):
  1. [most likely]   — evidence: [what points to this] — confidence: [high/medium/low]
  2. [second likely]  — evidence: [what points to this] — confidence: [high/medium/low]
  3. [third likely]   — evidence: [what points to this] — confidence: [high/medium/low]
  → Test #1 FIRST. If disproven, move to #2. Never test all at once.

IS THIS ROOT CAUSE OR SYMPTOM?
  "If I fix this, can the same bug happen with different input?"
  YES → dig deeper | NO → this is root cause

REPRODUCTION: [input + state + steps to trigger]
SIDE EFFECTS: [what else could break if I change this?]
FIX: [what to change]
REGRESSION TEST: [test case that fails before fix, passes after]
VERIFICATION: [command to run to confirm fix]
</think>
```

### Build / Create (Project Mode)
```
<think>
FEATURE: [description]
SCAN: [list top-level folders in src/ or app/]
PATTERN: [module-based / layer-based / hybrid]
REFERENCE: [most similar existing module + path]

── CONVENTION EXTRACTION (all from reference, NOT from memory) ──
FOLDER_PARENT:   [src/modules/ | src/features/ | app/Domains/ | src/ flat]
FOLDER_NAMING:   [singular/plural] + [kebab-case/camelCase/PascalCase]
FILE_NAMING:     [pattern with example: "orders.controller.ts" or "OrderController.ts"]
IMPORT_STYLE:    [alias: @/ ~/ @modules/ none] + [barrel index.ts: yes/no] + [example]
DATA_SOURCE:     [Prisma / TypeORM / SQLAlchemy / Eloquent / Mongoose — from reference]
API_STYLE:       [REST / GraphQL / gRPC — from reference]
VALIDATION:      [class-validator / Zod / Joi / Yup / Pydantic — from reference DTO]
ERROR_PATTERN:   [custom AppException / framework HttpException / Result type]
                 [global filter class name + error response shape]
RESPONSE_FORMAT: [raw return (interceptor wraps) / manual { data, message } / other]
                 [global interceptor name if exists]
DECORATORS:      [custom: @Auth(), @CurrentUser(), @Serialize() — list all from reference]
                 [framework default: @UseGuards(), @Req() — only if no custom wrapper]
REGISTRATION:    [app.module imports / RouterModule.register / app.use() / urls.py]
TEST_PATTERN:    [.spec.ts / .test.ts] + [co-located / subfolder / root __tests__/]
                 [runner: Jest / Vitest / pytest / JUnit / PHPUnit]

── CLONE MAP ──
  reference/[exact filename] → new-feature/[exact filename with same pattern]
  [list all files in reference module, 1:1 correspondence]

STATES: loading / error / empty / success
DEPS: [new packages needed? ASK before adding]
GLOBAL_MIDDLEWARE: [list from main.ts/app.module: TenantMiddleware, LoggingInterceptor, etc.]

⛔ ANY field marked UNKNOWN → Grep/Read to fill it BEFORE writing code
⛔ NEVER fill from architecture-intelligence.md defaults — ONLY from project files
</think>
```

### Build / Create (Default Mode)
```
<think>
FEATURE: [description]
FRAMEWORK: [detected framework]
REFERENCE: [framework reference file pattern]
LOCATION: [where files go per Clean Architecture]
PLAN:
1. [file] — [purpose]
2. [file] — [purpose]
DEPS: [needed? use correct pkg manager]
STATES: loading / error / empty / success
</think>
```

### Review / Audit
```
<think>
FILES: [list of files to review]
FRAMEWORK: [detected]
LANGUAGE: [detected — this determines which Per-Language Traps section to read]
PACKAGE_MANAGER: [npm/yarn/pnpm/pip/composer/maven/go mod]
LOCKFILE_VERSION: [check lockfile for exact versions of key dependencies]

── PLATFORM FOCUS ──
PER_LANGUAGE_TRAPS: read ONLY the [LANGUAGE] section in code-review.md
  → ⛔ SKIP all other language sections
  → Exception: cross-service bug involving 2 languages

── TIER 0: VERIFICATION (run FIRST) ──
LIBRARIES_USED: [list every library imported in reviewed files]
  For each library:
    □ Installed? [check package.json/requirements.txt/pom.xml]
    □ Version?   [from lockfile]
    □ Functions called: [list]
    □ All functions exist in this version? [verify — WebSearch if uncertain]
    □ Any deprecated? [check]
    □ Import paths correct? [verify]
PHANTOM_APIS_FOUND: [list any function that doesn't exist or wrong version]

── TIER 1-7: STANDARD REVIEW ──
  □ Tier 1 Architecture: separation of concerns, dependency direction, module structure
  □ Tier 2 Security: input validation, auth, SQL injection, secrets, authorization
  □ Tier 3 DB & Performance: N+1, indexes, transactions, unbounded queries, pagination
  □ Tier 4 Error handling: proper exceptions, no empty catch, consistent format
  □ Tier 5 Cross-module: who else uses changed code? interfaces updated? schema changes?
  □ Tier 6 Testing: coverage, edge cases, real-world scenarios
  □ Tier 7 Code quality: naming, unused code, magic numbers

── FINDINGS ──
CRITICAL: [list with file:line]
HIGH: [list with file:line]
MEDIUM: [list with file:line]
LOW: [list with file:line]
CLEAN_AREAS: [what looks good]
VERDICT: [APPROVE / REQUEST CHANGES / BLOCK]

⛔ NEVER skip Tier 0 — phantom APIs are #1 review failure
⛔ NEVER say "looks good" without reading ALL files
⛔ NEVER confirm a library function from memory — VERIFY
</think>
```

### Intent Analysis (every request — run FIRST)
```
<think>
USER_SAID: [exact user request — preserve original language]
CONVERSATION_CONTEXT: [what were we working on before this message?]

── INTENT EXTRACTION ──
ACTION:   [create | fix | update | delete | review | check | refactor | explain]
TARGET:   [file/module/feature — extract nouns from message]
CRITERIA: [what "done" / "correct" looks like — infer from context]
SCOPE:    [single file | feature module | project-wide]

── PATTERN DETECTION ──
PATTERN: [A=single clear | B=vague single | C=broad sweep | D=iterative loop | E=compound | F=circular | G=past reference | H=implicit continuation | I=code paste]

── IF PATTERN D (loop detection) ──
ATTEMPT_COUNT: [how many times same area was fixed this session]
PREVIOUS_APPROACH: [what I did last time]
USER_FEEDBACK: [why it was rejected]
GAP: [what I missed — be specific]
NEW_APPROACH: [something DIFFERENT from previous]

── IF PATTERN G (past reference) ──
REFERENCED_ACTION: [what action from history is user referring to?]
CURRENT_TARGET: [what should that action be applied to now?]

── IF PATTERN H (implicit continuation) ──
ACTIVE_WORK_PLAN: [yes/no — any remaining items?]
NEXT_ITEM: [if yes: which item | if no: infer from last discussed area]

── IF PATTERN I (code paste) ──
CODE_LANGUAGE: [detected from paste]
SCAN_RESULT: [Auto-Scan findings on pasted code]

── IF PATTERN C/E (broad / compound) ──
SCAN_STRATEGY: [Grep pattern | Glob path | Read specific files]
LOCATIONS_FOUND:
  1. [file:line] — [issue]
  2. [file:line] — [issue]
TOTAL_LOCATIONS: [N]
MODULES_AFFECTED: [list]

── WORK PLAN ──
  Item 1: [description] — [files] — [dependency]
  Item 2: [description] — [files] — [dependency]
CHECKPOINT_AFTER: [which items]

── DECISION ──
SCOPE_SIZE: [small (just do it) | medium (work plan) | large (checkpoints)]
NEEDS_SCAN: [yes/no — based on pattern]
NEEDS_LOOP_CORRECTION: [yes/no — based on attempt count]

⛔ If PATTERN=D and ATTEMPT_COUNT >= 3 → CHANGE strategy completely
⛔ If PATTERN=C and SCOPE=large → MUST present work plan before coding
⛔ NEVER ask user "what do you mean?" if you can infer from context
</think>
```

### Spec Interpretation (informal/vague requirement)
```
<think>
USER_SAID: [exact user text — preserve original language]

── PARSE (extract from informal text) ──
FEATURE: [name]
BEHAVIORS:
  1. [user can / system does — verb + object]
  2. [...]
CONDITIONS:
  □ [if X → then Y]
  □ [if A → then B]
INTEGRATIONS: [email / webhook / external API / queue]
SECURITY: [who can do this? auth required?]

── INFERRED (user didn't say, but implied) ──
EDGE_CASES:
  □ [what if duplicate request?] → [default handling]
  □ [what if concurrent?] → [default handling]
  □ [what about existing data?] → [default handling]
OUT_OF_SCOPE: [what user DIDN'T mention — flag it]

── COMPLEXITY ──
BEHAVIORS_COUNT: [N]
CONDITIONS_COUNT: [N]
FILES_ESTIMATE: [N]
DECISION: [simple (just build) | medium (explain + confirm) | complex (AI-DLC)]

⛔ If COMPLEXITY >= medium → MUST explain back before coding
⛔ NEVER assume what user didn't say — list it as INFERRED
⛔ ALWAYS separate SAID vs INFERRED in explanation
</think>
```

### Refactor
```
<think>
TARGET: [files/modules to refactor]
CURRENT PATTERN: [what exists now]
DESIRED PATTERN: [what it should become]
CONSTRAINTS:
  - NO behavior change
  - ALL existing tests must still pass
  - Preserve API contract
STEPS:
1. [step] — [what changes]
2. [step] — [what changes]
RISK: [what could break?]
</think>
```

---

## Source Verification Checklist

**Before suggesting ANY API call, function, or config:**

```
□ Does this function/method actually exist in the framework version being used?
□ Is the import path correct for this version?
□ Has the API signature changed in recent versions?
□ Is this a community package or built-in? Is it installed?
□ WebSearch to verify if uncertain about any of the above
```

---

## Context-Needed Declarations

**When you need to read files before answering:**

```
"I need to read [file] to give you an accurate answer."
"Let me check the existing [module/config] first."
"Checking the current [database schema / route setup / middleware chain]..."
```

**NEVER give advice about code you haven't Read.**

---

## Advanced Patterns

### Verification-First Pattern
```
BEFORE suggesting a solution:
1. Read the actual code (not from memory)
2. Verify the error/issue exists as described
3. Check if a fix already exists elsewhere in the codebase
4. THEN propose a solution grounded in what you read
```

### Investigate-Before-Answer Pattern
```
BEFORE answering "how does X work in this project":
1. Glob for related files
2. Grep for the specific function/class/config
3. Read the actual implementation
4. Answer with file:line citations
```

### Assumption-Driven Progress
```
WHEN blocked by unknown requirements:
1. State the assumption explicitly
2. Proceed with the most common/safe choice
3. Flag it: "Assumed [X]. Change if needed."
4. NEVER block waiting for confirmation on non-critical choices
```

### Negative Space Pattern
```
AFTER writing code, check what you DIDN'T write:
  - Missing error handling? Add it.
  - Missing input validation? Add it.
  - Missing auth check? Add it.
  - Missing database transaction? Add it.
  - Missing test? Note it.
```

### Batched Operations
```
WHEN creating multiple files:
  - Group related operations
  - Create entity/model FIRST
  - Then service/repository
  - Then controller/route
  - Then DTO/validation
  - Then tests
  - Register module/route LAST
```

### Error Recovery with Escalation
```
LEVEL 1: Fix the error directly (most common)
LEVEL 2: Read error-recovery.md for known patterns
LEVEL 3: WebSearch "[framework] [error] [year]"
LEVEL 4: Ask user for context (RULE 7: after 3 fails)
```

### Spec-First Pattern (RULE 8 — for features 3+ files)
```
BEFORE writing any code for complex features:
<think>
FEATURE: [name]
INTENT: [one sentence — what does this do for the user?]
UNITS:
  1. Database: [schema changes, migrations]
  2. Service: [business logic, validation rules]
  3. API: [endpoints, DTOs, status codes]
  4. Auth: [who can access, permission model]
  5. Tests: [what to test, edge cases]
DEPENDENCIES: [what must be built first, what existing code to clone]
DATA MODEL: [new tables/columns, relations]
API CONTRACT: [GET/POST/PUT/DELETE /api/v1/resource → request/response shape]
RISKS: [what could break, what needs user input]
COMPLEXITY: [S = < 3 files | M = 3-7 files | L = 8+ files]
</think>

→ Present spec to user BEFORE writing code
→ S = just build | M = confirm once | L = confirm each phase (AI-DLC)
```

### Precision-Over-Creativity Pattern
```
WHEN implementing a feature:
  ✅ Do EXACTLY what was asked — no more, no less
  ✅ Match the scope of the request precisely
  ⛔ Don't add extra endpoints "while you're at it"
  ⛔ Don't refactor surrounding code unless asked
  ⛔ Don't add comments/docs to code you didn't change
  ⛔ Don't suggest architecture changes unless asked

"What is the minimum code change that satisfies this request?"
→ That's what you should write.
```

---

## Quick Reference

```
XML TAGS (Anthropic best practice):
  <think>...</think>         — Internal reasoning (not shown to user)
  <context>...</context>     — Structured context for sub-agents
  <example>...</example>     — Code examples with language tags

RESPONSE LENGTH:
  Quick fix        → 1-5 lines
  New feature      → Show structure + key files
  Architecture     → Explain approach + folder tree
  Full explanation → Only when user asks "explain" or "why"
```
