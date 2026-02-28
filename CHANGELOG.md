# Changelog

All notable changes to `@buivietphi/skill-backend-mt` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-02-28

### Added — Intent Analysis & Request Understanding
- **shared/intent-analysis.md** (~4,320 tokens) — Intent Analysis Engine (9 patterns A-I), Spec Interpretation Protocol, Loop Detection & Self-Correction, Scope Inference Protocol, Multi-Task Splitting Protocol
- **Intent Analysis + Spec Interpretation think templates** (shared/prompt-engineering.md)

### Added — Implementation Patterns (10 new files, ~25,980 tokens)
- **shared/crud-patterns.md** (~3,860 tokens) — CRUD service generation with edge case checklists, state machine, multi-step orchestration + rollback
- **shared/error-handling-impl.md** (~2,890 tokens) — Custom exception hierarchy, global handler (NestJS + FastAPI), error propagation, timeout + retry
- **shared/caching-implementation.md** (~2,020 tokens) — Cache-aside, write-through, multi-level cache, stampede prevention
- **shared/pagination-patterns.md** (~2,240 tokens) — Offset + cursor pagination, filter whitelist, sort security
- **shared/testing-fixtures.md** (~2,720 tokens) — Factory pattern, test DB setup, mocking, integration tests
- **shared/file-handling.md** (~1,910 tokens) — Upload, S3/presigned URL, image processing, cleanup CRON
- **shared/background-jobs.md** (~1,930 tokens) — BullMQ/Celery handlers, retries, DLQ, scheduled tasks
- **shared/webhook-patterns.md** (~2,120 tokens) — HMAC signature verification, dedup, idempotent handlers, delivery
- **shared/concurrency-patterns.md** (~2,200 tokens) — Optimistic/pessimistic locking, distributed lock, idempotency keys
- **shared/logging-impl.md** (~2,080 tokens) — Structured logging (Pino/structlog), correlation IDs, PII redaction

### Changed
- SKILL.md: 51,877 → 56,573 bytes (~14,140 tokens) — split Intent Analysis into on-demand file + added 10 implementation pattern entries to Task Router
- shared/ folder: 18 → 28 files
- Smart load budget: ~30,080 → ~31,740 tokens (24.8% of 128K)
- Full load: ~62,500 → ~106,340 tokens (83.1% of 128K)
- Coverage: 65% → ~90% senior backend coverage — added "HOW to implement" alongside "what NOT to do"

---

## [1.1.0] — 2026-02-28

### Added
- **RULE 10: DISCOVER BEFORE EXECUTE** — New cardinal rule for broad/multi-part requests
- **Multi-Part Execution Protocol** (SKILL.md) — 3-phase workflow: Discover → Execute with checkpoints → Verify completion
- **Discovery-Execute Workflow** (shared/ai-dlc-workflow.md) — Replaces AI-DLC for sweep/fix/update across existing code
- **Scope Clarification Protocol** (SKILL.md) — Forces AI to clarify vague requests ("sửa cho đúng", "fix it properly")
- **Multi-Task Splitting Protocol** (SKILL.md) — Splits "fix A, then B, then C" into discrete tracked items
- **Completion Check** in Quality Gate — Verifies ALL work plan items done before saying "done"
- **Multi-Part think template** (shared/prompt-engineering.md) — Auto-think for broad/vague/multi-task requests
- **Task Router entries** for broad requests — "Fix all X", "sửa nhiều chỗ", "check and fix everything"

### Changed
- SKILL.md: 43,906 → 51,877 bytes (~12,970 tokens)
- shared/ai-dlc-workflow.md: 4,836 → 9,371 bytes (~2,340 tokens)
- shared/prompt-engineering.md: 10,347 → 11,718 bytes (~2,930 tokens)
- Smart load budget: ~27,750 → ~30,080 tokens (23.5% of 128K)

### Fixed
- AI completing only partial work on broad requests ("fix many places" → now discovers ALL locations first)
- AI stopping after 1-2 fixes when user asked for comprehensive changes
- Missing checkpoint reports during multi-module work
- No scope discovery before execution on "fix all X" type requests

---

## [1.0.0] — 2026-02-27

### Core
- **SKILL.md** — Master entry point with 9 Cardinal Rules, 28+ Task Router entries, Auto-Detect (15+ frameworks), Quality Gate, Self-Critique Loop with Anti-Rationalization, Security Protocol (OWASP Top 10), 16 Hard Bans, Backend Anti-Patterns, Leverage Pyramid, Session State Tracking
- **AGENTS.md** — Multi-agent compatibility for 12 AI agents (Claude Code, Cline, Roo Code, Cursor, Windsurf, Copilot, Codex, Gemini, Kimi, Kilo Code, Kiro, Antigravity) with Smart Loading Protocol and Token Budget

### Framework References
- **nodejs/nestjs.md** — NestJS module system, DI, decorators, guards, Prisma/TypeORM integration
- **nodejs/nextjs.md** — Next.js App Router, API routes, middleware, SSR patterns
- **nodejs/express.md** — Express/Fastify middleware pipeline, routing, error handling
- **nodejs/vuejs.md** — Vue.js/Nuxt patterns, Pinia state management, SSR
- **python/fastapi.md** — FastAPI async patterns, Pydantic, dependency injection, SQLAlchemy
- **python/django.md** — Django ORM, DRF serializers, signals, middleware
- **java/spring-boot.md** — Spring Boot auto-config, JPA, Spring Security, actuator
- **php/laravel.md** — Laravel Eloquent, service container, middleware, queues
- **others/go-ruby-rust.md** — Go (Gin/Echo), Ruby on Rails, Rust (Axum/Actix)

### Shared Modules
- **shared/bug-detection.md** — Triage Protocol (6 input types), Health Check Protocol (6 scan categories), Log Analysis (per-runtime stack trace parsing: Node.js, Python, Java, PHP, Go), Error Type → Search Strategy (10 types), Investigate Workflow, Find File from Description, Check Issue Workflow, Reproduction Protocol, Anti-Rationalization (debug-specific)
- **shared/error-recovery.md** — Build/Runtime/Deployment error patterns, Build Error Routing (dependency vs code vs config decision tree), Multi-Service Debug Protocol, Performance Bug Debug Protocol, Rollback-First strategy
- **shared/prompt-engineering.md** — Auto-Think Templates (Fix/Debug, Build/Create, Review, Refactor), Source Verification, Advanced Patterns (Verification-First, Investigate-Before-Answer, Assumption-Driven Progress, Negative Space, Spec-First, Precision-Over-Creativity)
- **shared/architecture-intelligence.md** — Clean Architecture, Hexagonal, DDD, CQRS with decision matrix, cross-framework patterns
- **shared/api-design.md** — REST, GraphQL, gRPC, WebSocket conventions, HTTP Caching (Cache-Control, ETag, CDN), Multi-Language API (i18n)
- **shared/database-patterns.md** — Database Selection Matrix, Schema Design (SQL + NoSQL), ORM patterns (Prisma, TypeORM, SQLAlchemy, Eloquent, Spring Data JPA), Migration best practices, Query Optimization (N+1, indexing, pooling, transactions), Data Integrity Protocol, Zero-Downtime Migration
- **shared/auth-security.md** — JWT + refresh token, OAuth 2.0, RBAC/ABAC, password hashing, rate limiting, CORS, secret management
- **shared/microservices.md** — Service decomposition, bounded contexts, API gateway, service mesh, event-driven communication
- **shared/testing-strategy.md** — Testing pyramid, per-framework unit testing (Jest, pytest, JUnit, PHPUnit), integration testing, load testing
- **shared/ci-cd.md** — Docker multi-stage builds, GitHub Actions, deployment strategies (blue-green, canary, rolling)
- **shared/observability.md** — Structured logging, OpenTelemetry, correlation IDs, alerting
- **shared/performance-optimization.md** — Multi-level caching, connection pooling, query optimization, CDN
- **shared/common-pitfalls.md** — Common backend mistakes by experience level
- **shared/version-management.md** — Dependency management, lockfile hygiene, major version upgrades
- **shared/ai-dlc-workflow.md** — AI-DLC 4-phase workflow for complex features (Elaborate → Construct with 4 Hats → Backpressure Gates → Complete)
- **shared/document-analysis.md** — Parse API specs, ERDs, design docs into code scaffolds
- **shared/code-review.md** — Senior review checklist
- **shared/agent-rules-template.md** — Template for project-level agent rules
- **shared/claude-md-template.md** — CLAUDE.md generation template

### Installer
- **bin/install.mjs** — Interactive checkbox UI, per-agent install (`--claude`, `--codex`, `--gemini`, `--kimi`, `--antigravity`, `--all`), project-level rules generation (`--init cursor`, `--init windsurf`, `--init cline`, `--init roocode`, `--init copilot`, `--init kilocode`, `--init kiro`, `--init all`), auto-detect on postinstall

### Humanizer
- **humanizer/humanizer-backend.md** — Humanize AI-generated code comments, API docs, and error messages
