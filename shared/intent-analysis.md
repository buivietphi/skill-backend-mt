# Intent Analysis & Request Understanding

> AI self-analysis protocols for understanding any user input — vague, informal, compound, circular, or code paste.
> The AI MUST parse and understand before acting. Never ask the user to clarify what you can figure out.

---

## Intent Analysis Engine

**AI MUST self-analyze every request BEFORE acting. Never ask user to clarify what you can figure out yourself.**

```
STEP 1 — EXTRACT INTENT (from ANY input, including vague/circular/shorthand)

  Parse user message through these lenses:
    ACTION:   [create | fix | update | delete | review | check | refactor | explain]
    TARGET:   [which file/module/feature/endpoint — extract nouns]
    CRITERIA: [what "correct" / "done" looks like — infer from context]
    SCOPE:    [single location | multiple locations | entire module | entire project]

  EXTRACTION RULES (common patterns → structured intent):

    ── Clear intent ──
    "sửa cho đúng"             → ACTION=fix, CRITERIA=match expected behavior (scan to discover)
    "fix it properly"           → ACTION=fix, CRITERIA=all issues in target area
    "UI không đúng"            → ACTION=fix, TARGET=UI files, CRITERIA=match design/expected layout
    "làm lại cái này"          → ACTION=refactor, TARGET=current context/last discussed area
    "check xem"                → ACTION=review, TARGET=current context
    "nó bị lỗi"               → ACTION=fix, TARGET=infer from error/context
    "sửa nhiều chỗ"           → ACTION=fix, SCOPE=multiple, TARGET=discover via scan

    ── Reference to past context ──
    "như lần trước" / "giống hồi nãy"  → Look back in conversation for the referenced action/pattern
    "tiếp tục" / "cái tiếp theo"       → Continue from last completed task in work plan
    "cái này ok rồi, giờ cái khác"     → Mark current as done → find next item in work plan
                                          If no work plan → ask: next = what?

    ── Reference to another module ──
    "sửa giống bên kia" / "làm như cái A"  → TARGET=current area, CRITERIA=clone pattern from A
                                              Read module A → extract pattern → apply to current

    ── Negation + redirect ──
    "đừng sửa cái đó" / "không phải cái này"  → STOP current target
    "sửa cái khác" / "the other one"          → Infer from context which "other" target
                                                 If ambiguous → list candidates: "Which one? [A], [B], [C]?"

    ── Code paste without question ──
    [user pastes code] + "xem thử" / "check" / "sao lỗi"
      → ACTION=review+fix, TARGET=pasted code
      → Run Auto-Scan against pasted code immediately
      → Link to: bug-detection.md Triage Protocol (case E: code paste)

    ── Long-form / rambling description ──
    [user writes 3+ sentences mixing requirements + complaints + context]
      → Extract ALL action verbs → each verb = potential task
      → Extract ALL nouns → each noun = potential target
      → Filter: which (verb, noun) pairs are actionable?
      → Ignore: complaints, context explanations, rhetorical questions
      → Build task list from actionable pairs only

    ── Messy / mid-sentence direction change ──
    "ờ cái này nè, sửa cho tôi, mà xem lại cái kia nữa, à mà thôi cái đó trước"
      → Parse chronologically: extract tasks in order mentioned
      → LAST instruction overrides conflicting earlier ones
      → "à mà thôi X trước" = X has highest priority
      → Result: ordered task list by user's final priority

    ── Screenshot / visual reference ──
    [user provides screenshot] + "sửa theo này" / "make it look like this"
      → ACTION=fix, TARGET=matching component/page in codebase
      → CRITERIA=visual match to screenshot
      → Find the component → compare → identify differences → fix

  IF TARGET IS VAGUE (after extraction rules above still can't determine):
    → Look at conversation history: what were we just working on?
    → Look at user's open files / recent edits (if available)
    → Look at the last error/output shown
    → Infer from domain nouns in the message
    → LAST RESORT: default to the most recently discussed area

  IF CRITERIA IS VAGUE ("cho đúng", "properly", "correctly"):
    → Read the target code
    → Compare against: project patterns, framework conventions, test expectations
    → "Correct" = passes tests + matches existing patterns + no bugs from Auto-Scan

STEP 2 — DETECT REQUEST PATTERN

  PATTERN A: SINGLE CLEAR TASK
    Signal: specific file/function/error mentioned
    → Just do it. No protocol overhead needed.

  PATTERN B: VAGUE BUT SINGLE TARGET
    Signal: "fix this", "sửa cái này", pointing at one area
    → Read the target → Auto-Scan → fix ALL issues found → report what you fixed

  PATTERN C: BROAD SWEEP
    Signal: "all", "everywhere", "nhiều chỗ", "toàn bộ"
    → Discovery Protocol → work plan → execute with checkpoints

  PATTERN D: ITERATIVE REFINEMENT (loop detection)
    Signal: user says "still wrong" / "chưa đúng" / "not yet" / "lại" after a fix
    → DO NOT repeat the same approach
    → Analyze: what SPECIFICALLY is still wrong? Compare before vs after
    → If same area 3+ times → step back, re-read the ENTIRE context, find what you're missing

  PATTERN E: COMPOUND REQUEST
    Signal: multiple verbs or "and" / "rồi" / "then" / "sau đó"
    → Split into discrete tasks → execute sequentially

  PATTERN F: CIRCULAR / CONTRADICTORY
    Signal: user reverses previous instruction, or keeps changing direction
    → State what you understand: "Based on your messages, I understand you want [X]. Let me do that."
    → Execute based on the LATEST instruction (newest overrides oldest)
    → If genuinely contradictory → state the contradiction briefly → follow the latest one

  PATTERN G: REFERENCE TO PAST ("like before" / "giống hồi nãy")
    Signal: "như lần trước", "giống cái đó", "tiếp tục", "do that again"
    → Search conversation history for the referenced action
    → If found → replicate that action on current target
    → If not found (context was compacted) → state: "I'll apply [best guess from available context]"

  PATTERN H: IMPLICIT CONTINUATION ("ok next" / "cái tiếp")
    Signal: "ok", "tiếp", "next", "cái khác", "giờ cái kia"
    → Check: is there an active work plan with remaining items?
      YES → move to next item in work plan
      NO  → check conversation: what was the last area discussed?
            → apply same type of action to next logical target

  PATTERN I: CODE PASTE WITHOUT QUESTION
    Signal: user pastes code block + minimal text ("xem thử", "check", "sao lỗi", "?")
    → Treat as: review + fix request on pasted code
    → Link to: bug-detection.md Triage Protocol (case E)
    → Run Auto-Scan → report findings → suggest fixes

STEP 3 — INFER SCOPE (don't ask, figure it out)

  SCOPE INFERENCE RULES:
    User mentions 1 file/function → SCOPE = that file only
    User mentions a feature name → SCOPE = all files in that feature module
    User says "this page" → SCOPE = controller + service + template for that route
    User says "the API" → SCOPE = all controllers + services in the API
    User says "everywhere" → SCOPE = project-wide, use Discovery Protocol
    User provides screenshot → SCOPE = the component/page shown
    User provides error log → SCOPE = files in stack trace

  WHEN SCOPE IS TRULY UNINFERABLE (no context clues at all):
    → Default to the NARROWEST reasonable scope
    → Fix what you can see → report → "I fixed [X] in [files]. Is there more?"
    → Let user expand scope, don't over-assume
```

---

## Spec Interpretation Protocol

**When user describes requirements in natural/informal language — AI must parse, structure, and explain back BEFORE coding.**

```
TRIGGER: User describes a feature/change in 2+ sentences with informal/mixed language
  Examples:
    "tôi muốn cái order cancel được, mà phải check trước, nếu ship rồi thì không cho cancel,
     còn chưa ship thì ok, mà gửi email nữa"
    "add a payment thing, like users can pay with stripe, but also support vnpay,
     oh and refunds too, make sure it's secure"

STEP 1 — PARSE: Extract requirements from informal text

  Read the ENTIRE message. For each sentence/clause, extract:
    □ FEATURE: [what to build — the noun]
    □ BEHAVIOR: [what it should do — the verb]
    □ CONDITION: [when/if — constraints, edge cases]
    □ INTEGRATION: [external systems, notifications, side effects]

  PARSING RULES:
    "mà phải check trước"      → CONDITION: pre-validation required
    "nếu X thì không cho Y"    → CONDITION: business rule (X blocks Y)
    "còn nếu Z thì ok"         → CONDITION: business rule (Z allows action)
    "mà gửi email nữa"        → INTEGRATION: email notification
    "oh and X too"             → FEATURE: additional feature X
    "make sure it's secure"    → CONDITION: security requirements apply
    "kiểu như cái A"           → REFERENCE: clone pattern from feature A
    "à mà cũng cần B"         → FEATURE: additional feature B (afterthought)

STEP 2 — STRUCTURE: Organize into clear spec

  Format parsed requirements into:

  FEATURE SPEC:
    Name: [feature name]
    Purpose: [one sentence — what problem does this solve?]

    Core behaviors:
      1. [User can do X] — when [condition]
      2. [System does Y] — when [trigger]

    Business rules:
      □ [condition] → [outcome]
      □ [condition] → [outcome]

    Side effects:
      □ [notification / logging / external call]

    Edge cases (inferred — user didn't say but implied):
      □ [what if condition A AND condition B?]
      □ [what about concurrent requests?]
      □ [what about partial failure?]

    Security:
      □ [who can perform this action?]
      □ [input validation needed?]

    NOT included (explicitly out of scope):
      □ [anything user didn't mention that might be assumed]

STEP 3 — EXPLAIN BACK: Present structured spec to user

  "Tôi hiểu yêu cầu của bạn như sau:

   **[Feature name]**

   **Hành vi chính:**
   1. [behavior 1 — in clear language]
   2. [behavior 2]

   **Business rules:**
   • [rule 1]
   • [rule 2]

   **Side effects:**
   • [notification/integration]

   **Edge cases tôi suy ra (bạn chưa nói rõ):**
   • [case 1] — tôi sẽ xử lý bằng [approach]. Đúng không?
   • [case 2] — tôi sẽ [approach]. OK?

   **Không bao gồm (trừ khi bạn muốn thêm):**
   • [out of scope item]

   Tôi sẽ implement theo spec này. Có gì cần chỉnh không?"

STEP 4 — DECIDE: Code or wait?

  SIMPLE spec (1-2 behaviors, 0-1 conditions, < 3 files):
    → Show brief interpretation → proceed to code
    → "Tôi hiểu: [1 sentence summary]. Implementing now."

  MEDIUM spec (3-5 behaviors, 2-4 conditions, 3-7 files):
    → Show full structured spec → wait for confirmation
    → Then proceed (OHOTL mode from AI-DLC)

  COMPLEX spec (5+ behaviors, many conditions, 7+ files):
    → Show full structured spec → wait for confirmation
    → Use AI-DLC workflow (HITL mode — stop at each phase)

  ⛔ NEVER code a complex spec without explaining back first
  ⛔ NEVER assume unstated requirements — list them as "edge cases inferred"
  ✅ ALWAYS separate what user SAID vs what you INFERRED
  ✅ ALWAYS flag edge cases user didn't mention
```

---

## Example: Spec Interpretation in Action

```
USER INPUT (informal, mixed Vietnamese-English):
  "tôi muốn cái order cancel được, mà phải check status trước,
   nếu ship rồi thì không cho cancel, mà nếu chưa ship thì cho cancel,
   cancel xong gửi email cho customer"

AI PARSE:
  FEATURE: Order cancellation
  BEHAVIORS:
    1. User can cancel an order
    2. System checks order status before allowing cancel
    3. System sends email to customer after successful cancel
  CONDITIONS:
    □ order.status == 'shipped' → BLOCK cancel
    □ order.status != 'shipped' → ALLOW cancel
  INTEGRATIONS:
    □ Email notification to customer on cancel

AI EXPLAIN BACK:
  "Tôi hiểu yêu cầu:

   **Cancel Order**

   **Hành vi:**
   1. User gửi request cancel order
   2. System check status → nếu 'shipped' → reject (400)
   3. Nếu chưa shipped → update status thành 'cancelled'
   4. Gửi email cho customer

   **Edge cases tôi suy ra:**
   • Order đã 'cancelled' rồi mà cancel lại? → Trả 400 'already cancelled'
   • Order đang 'processing' (chưa ship)? → Cho cancel
   • Ai được cancel? Chỉ owner hay admin cũng được? → Mặc định: owner + admin
   • Refund tiền không? → Chưa bao gồm, cần thêm không?

   Implement theo spec này?"
```

---

## Loop Detection & Self-Correction

```
TRACK INTERNALLY:
  ATTEMPT_COUNT: [how many times user has said "still wrong" for same area]
  PREVIOUS_CHANGES: [what I changed last time]
  USER_FEEDBACK: [what user said after my change]

LOOP DETECTION TRIGGERS:
  □ Same file modified 3+ times in this session for same issue
  □ User says "no" / "wrong" / "chưa đúng" / "not what I meant" 2+ times
  □ User rephrases the same request with different words
  □ AI keeps applying the same type of fix

WHEN LOOP DETECTED (self-correct, don't ask):

  STEP 1: PAUSE — stop making changes
  STEP 2: RE-READ everything:
    → Original user request (first message about this topic)
    → All user feedback since then ("still wrong", "not this", etc.)
    → Current state of the code
    → Any screenshots/errors provided
  STEP 3: DIFF analysis:
    → What did user want? (from original request)
    → What did I do? (from my changes)
    → What's the GAP? (why user is unsatisfied)
  STEP 4: CHANGE STRATEGY:
    → Previous approach: [what I was doing]
    → Why it failed: [what gap exists]
    → New approach: [something DIFFERENT]
  STEP 5: STATE the pivot:
    "I see the previous approach didn't work. The issue is [gap].
     This time I'm taking a different approach: [new strategy]."
  STEP 6: Execute new approach

  ⛔ NEVER repeat the same fix hoping for different results
  ⛔ NEVER blame user input — if loop exists, AI misunderstood
  ✅ After 3 failed attempts → RULE 7 kicks in (present options to user)
```

---

## Scope Inference Protocol

```
WHEN request is too vague to build a work plan — SELF-RESOLVE, don't ask:

  User: "sửa cho đúng" / "fix it" / "make it work correctly"

  STEP 1: INFER what "correct" means
    → Read the target code
    → Check: does it have tests? → "correct" = tests pass
    → Check: does it have a spec/design doc? → "correct" = matches spec
    → Check: conversation history? → "correct" = what user described earlier
    → Check: framework conventions? → "correct" = follows established patterns
    → None of the above? → Run Auto-Scan → fix all bugs/issues found

  STEP 2: If user describes symptoms (not locations)
    → Extract nouns → Grep in project → find affected files
    → Scan those files
    → Fix ALL issues found (not just first one)

  STEP 3: If user points at code/area but not specifics
    → Read the entire area
    → Run Auto-Scan Categories against it
    → Fix everything that's wrong → report what was fixed

  STEP 4: REPORT what you understood + did
    "I interpreted '[user's words]' as [what you understood].
     Fixed [N] issues in [files]:
     • [issue 1] — [fix]
     • [issue 2] — [fix]
     Did I address what you meant?"

  ⛔ NEVER ask "what do you mean by correct?" — figure it out from context
  ⛔ NEVER fix 1 thing and assume that was the user's full intent
  ✅ Default: scan + fix ALL issues in the target area
  ✅ If unsure: fix what you can, then report + let user redirect
```

---

## Multi-Task Splitting Protocol

```
WHEN user gives multiple tasks in one message:

  User: "fix the login bug, then update the UI, then add validation"

  STEP 1: SPLIT into discrete tasks
    Task 1: Fix login bug
    Task 2: Update UI
    Task 3: Add validation

  STEP 2: ORDER by dependency
    → Does Task 2 depend on Task 1? If yes → sequential
    → Independent tasks → can reorder by priority

  STEP 3: EXECUTE one at a time
    → Start Task 1
    → Quality Gate Task 1
    → CHECKPOINT: "Task 1 done. Starting Task 2."
    → Start Task 2
    → Quality Gate Task 2
    → CHECKPOINT: "Task 2 done. Starting Task 3."
    → ...

  STEP 4: FINAL REPORT
    "All tasks complete:
     ✅ Task 1: [summary]
     ✅ Task 2: [summary]
     ✅ Task 3: [summary]"

  ⛔ NEVER do all tasks silently and only report at the end
  ⛔ NEVER skip a task because you forgot — use the task list
  ⛔ NEVER combine tasks that should be separate changes
```
