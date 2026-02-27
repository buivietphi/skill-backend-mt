# AI-DLC Workflow for Backend Features

> AI-Driven Development Lifecycle — structured workflow for complex multi-module backend features.

---

## When to Use AI-DLC

```
USE WHEN:
  ✅ Feature spans 3+ files (controller + service + repository + DTO + migration + tests)
  ✅ Feature requires database changes
  ✅ Feature involves multiple services (microservices)
  ✅ Feature has complex business logic
  ✅ Feature requires auth/security changes

DON'T USE WHEN:
  ⛔ Simple CRUD endpoint (just scaffold directly)
  ⛔ Bug fix (use error recovery protocol)
  ⛔ Config change (just edit the file)
  ⛔ Broad/multi-part requests → use Discovery-Execute Workflow below
```

---

## Discovery-Execute Workflow

> For broad requests that span multiple locations: "fix all X", "update everywhere", "sửa nhiều chỗ", "fix these issues".
> This workflow replaces AI-DLC when the task is NOT a new feature but a sweep/fix/update across existing code.

### When to Use

```
USE WHEN:
  ✅ User says "fix all / update all / change everywhere / sửa nhiều chỗ"
  ✅ User lists 3+ separate tasks in one message
  ✅ User describes problem without specific location ("UI is broken", "it's not working right")
  ✅ Fix/update will touch 5+ files across 2+ modules
  ✅ User says "fix for correct" / "sửa cho đúng" without specifying what's wrong

DON'T USE WHEN:
  ⛔ Single-file fix with clear location → just fix it
  ⛔ New feature creation → use AI-DLC above
  ⛔ Single bug with stack trace → use bug-detection.md
```

### Phase D1: DISCOVER

```
GOAL: Find ALL locations that need changes BEFORE touching any code.

STEP 1 — UNDERSTAND THE REQUEST
  Parse user message into:
    WHAT:  [what behavior/pattern/UI to change]
    WHERE: [specific files? modules? entire project?]
    WHY:   [bug? visual mismatch? requirements changed? refactor?]

  If any field is UNKNOWN:
    → Scan the area user described
    → Or ask: "Which area/page/module is affected?"

STEP 2 — SCAN & CATALOG
  For "fix all X" type:
    → Grep for the pattern across project
    → List EVERY occurrence with file:line

  For "fix this page/feature":
    → Read all files in that area
    → Run relevant Auto-Scan Categories (bug-detection.md)
    → List ALL issues found (not just the first one)

  For "fix A, B, and C" (multiple tasks):
    → Split into discrete work items
    → For each: locate the target files

  CATALOG FORMAT:
    WORK_ITEM_1: [description]
      → [file:line] — [what's wrong / what to change]
      → [file:line] — [what's wrong / what to change]
    WORK_ITEM_2: [description]
      → [file:line] — [what's wrong / what to change]
    ...
    TOTAL: [N] work items, [M] files, [K] modules

STEP 3 — PRESENT WORK PLAN (mandatory — NEVER skip)
  Show user the full catalog:
    "I scanned [area] and found [N] items to fix:

     **1. [Work item]** — [N files]
       • file:line — [issue]
       • file:line — [issue]

     **2. [Work item]** — [N files]
       • file:line — [issue]

     **Total: [N] changes across [M] files**

     Fix all? Or prioritize specific items?"

  ⛔ NEVER start fixing without presenting the work plan
  ⛔ NEVER say "I found some issues" — list ALL of them
```

### Phase D2: EXECUTE (with checkpoints)

```
EXECUTION RULES:
  1. Work through items IN ORDER (or user-specified priority)
  2. Complete one work item fully before starting the next
  3. After each work item → mini Quality Gate (type check + lint)
  4. After each MODULE boundary → CHECKPOINT report to user

CHECKPOINT FORMAT:
  "✅ Work item 1: [name] — DONE
     • [file]: [what changed]

   ⬜ Work item 2: [name] — NEXT
   ⬜ Work item 3: [name] — PENDING

   Progress: [X/N] items done. Continue?"

WHEN TO CHECKPOINT (pick the first that applies):
  □ After every module boundary (switching from module A to module B)
  □ After every 5 file changes (if all in same module)
  □ After completing a logical group of related changes
  □ After any change that might break other things (shared types, interfaces)

⛔ NEVER silently complete 10+ files without a checkpoint
✅ User should ALWAYS know what was done and what's next
```

### Phase D3: VERIFY COMPLETION

```
AFTER all work items done:
  □ Re-scan: Grep for the pattern again → any locations missed?
  □ Compare: work plan said [N] items → actually completed [N]?
  □ Run full Quality Gate (not per-item — full project)
  □ Report any NEW issues discovered during fixes

COMPLETION REPORT:
  "All items complete:

   ✅ Item 1: [summary] — [N files]
   ✅ Item 2: [summary] — [N files]
   ✅ Item 3: [summary] — [N files]

   **Total: [X] files changed**
   **Quality Gate: types ✅ | lint ✅ | tests ✅**

   [If new issues found during work]:
   ⚠️ [N] new issues discovered:
     • [issue] — want me to fix?

   [If items were skipped]:
   ⏭️ [N] items skipped (reason: [why])
     • [item] — blocked by [dependency]"

⛔ NEVER say "done" if work plan count ≠ completed count
⛔ NEVER skip the re-scan verification
```

---

## Phase 1: ELABORATE

**Decompose the feature into Intent + Units.**

```
INTENT: [What does this feature do? One sentence.]

UNITS:
  1. Database Layer    → Entity/Model + Migration + Seed data
  2. Data Access Layer → Repository/DAO + Query methods
  3. Business Layer    → Service + Validation + Business rules
  4. API Layer         → Controller/Route + DTOs + Swagger docs
  5. Auth Layer        → Guards/Middleware + Permissions
  6. Test Layer        → Unit tests + Integration tests
  7. Config Layer      → Env vars + Config updates

DEPENDENCIES:
  Unit 1 → Unit 2 → Unit 3 → Unit 4 (sequential)
  Unit 5 can be parallel with Unit 3-4
  Unit 6 after Unit 3-4
  Unit 7 independent
```

---

## Phase 2: CONSTRUCT (4 Hats per Unit)

**For each Unit, cycle through 4 perspectives:**

### Hat 1: Architect
```
ASKS:
  - Where does this code live? (which module/folder)
  - What's the reference module to clone from?
  - What interfaces/contracts does it expose?
  - What are the dependencies?
  - Does it follow existing patterns?
```

### Hat 2: Builder
```
DOES:
  - Writes the actual code
  - Follows the pattern from reference module
  - Implements all 4 states (loading/error/empty/success)
  - Handles edge cases
```

### Hat 3: Security
```
CHECKS:
  - Input validated at entry point?
  - Auth/authorization on endpoint?
  - No SQL injection risk?
  - No secrets exposed?
  - No sensitive data in logs?
  - Rate limiting needed?
```

### Hat 4: Reviewer
```
VERIFIES:
  - Code matches project conventions
  - Tests cover happy path + error path
  - No N+1 queries
  - Migrations are reversible
  - Error responses are consistent
```

---

## Phase 3: BACKPRESSURE GATES

**After each Unit, verify before proceeding:**

```
GATE 1: COMPILER    → Types check (tsc, mypy, javac, phpstan)
GATE 2: LINTER      → Lint clean (eslint, ruff, checkstyle, phpcs)
GATE 3: TESTS       → Unit tests pass
GATE 4: MIGRATION   → Migration runs (up AND down)
GATE 5: SECURITY    → No new vulnerabilities introduced
GATE 6: CONTRACT    → API contract preserved (or versioned)

If ANY gate fails → FIX before proceeding to next Unit.
```

---

## Phase 4: COMPLETE

```
FINAL CHECKLIST:
  □ All Units implemented
  □ All Gates passing
  □ Integration tests pass
  □ API documentation updated (Swagger/OpenAPI)
  □ Environment variables documented
  □ Migration scripts included
  □ No console.log/print in production code

SUMMARY FORMAT:
  "Created [feature] with:
   - [N] new files
   - [N] modified files
   - [N] tests (all passing)
   - Migration: [table created/modified]
   - Endpoints: [GET/POST/PUT/DELETE /api/v1/resource]"
```

---

## Phase Approval Gates

**STOP after each phase. Present results. Wait for user confirmation.**

```
GATE 1 — After Phase 1 (ELABORATE):
  Show:
    "Intent: [one sentence]
     Units: [numbered list with purpose]
     Dependencies: [build order]
     Risks: [what could go wrong]"
  Ask: "Proceed with design phase?"
  → Wait for YES before Phase 2

GATE 2 — After Phase 2 (CONSTRUCT, design only — no code written yet):
  Show:
    "Files to create: [list]
     Files to modify: [list]
     Schema changes: [migrations needed]
     API contract: [endpoints + DTOs]"
  Ask: "Proceed with implementation?"
  → Wait for YES before writing code

GATE 3 — After Phase 3 (all code written):
  Show:
    "Gates: compiler ✅ | lint ✅ | tests ✅ | security ✅ | migration ✅
     Created: [N files] | Modified: [N files]
     Endpoints: [list]"
  Ask: "Ready to ship?"
```

---

## Operating Modes

```
HITL  (Human-In-The-Loop):
  → Stop at ALL 3 gates for user approval
  → Use for: auth, payments, migrations, external APIs, critical features

OHOTL (One-Human-One-Turn-Loop):
  → Stop at Gate 1 (Elaborate) for approval, then auto-execute Phase 2+3
  → Use for: standard feature work, CRUD+

AHOTL (All-Hands-One-Turn-Loop):
  → Execute all phases autonomously, present final result
  → Use for: simple boilerplate, < 3 files, no migration

DEFAULT SELECTION:
  Touching auth/payments/migrations → HITL
  Standard feature (3-7 files)     → OHOTL
  Simple endpoint (< 3 files)      → AHOTL
```
