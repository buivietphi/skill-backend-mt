# AGENTS.md — Multi-Agent Compatibility

> skill-backend-mt works with 12 AI agents. This file describes how each agent loads the skill.
> Updated from research of top 53k+ star skill repos. Cardinal rules, self-critique loops, leverage pyramid, verification-first.

---

## Quick Start

```bash
# Install to your AI agent
npx @buivietphi/skill-backend-mt              # Interactive checkbox UI
npx @buivietphi/skill-backend-mt --claude     # Claude Code
npx @buivietphi/skill-backend-mt --codex      # Codex
npx @buivietphi/skill-backend-mt --gemini     # Gemini CLI
npx @buivietphi/skill-backend-mt --all        # All detected agents

# Generate project-level rules
npx @buivietphi/skill-backend-mt --init           # Interactive
npx @buivietphi/skill-backend-mt --init cursor     # Just Cursor
npx @buivietphi/skill-backend-mt --init all        # All agents
```

---

## Agent Compatibility Matrix

| Agent | Loading Method | Install Command |
|-------|---------------|----------------|
| **Claude Code** | `~/.claude/skills/` | `npx skill-backend-mt --claude` |
| **Cline** | `.clinerules/` in project | `npx skill-backend-mt --init cline` |
| **Roo Code** | `.roo/rules/` in project | `npx skill-backend-mt --init roocode` |
| **Cursor** | `.cursorrules` in project | `npx skill-backend-mt --init cursor` |
| **Windsurf** | `.windsurfrules` in project | `npx skill-backend-mt --init windsurf` |
| **Copilot** | `.github/copilot-instructions.md` | `npx skill-backend-mt --init copilot` |
| **Codex** | `~/.codex/skills/` | `npx skill-backend-mt --codex` |
| **Gemini CLI** | `~/.gemini/skills/` | `npx skill-backend-mt --gemini` |
| **Kimi** | `~/.kimi/skills/` | `npx skill-backend-mt --kimi` |
| **Kilo Code** | `.kilocode/rules/` in project | `npx skill-backend-mt --init kilocode` |
| **Kiro** | `.kiro/steering/` in project | `npx skill-backend-mt --init kiro` |
| **Antigravity** | `~/.agents/skills/` | `npx skill-backend-mt --antigravity` |

---

## Two Types of Agents

### Skills-Directory Agents
**Claude Code, Codex, Gemini CLI, Kimi, Antigravity**

These agents load skills from a global directory:
```
~/.claude/skills/skill-backend-mt/
~/.codex/skills/skill-backend-mt/
~/.gemini/skills/skill-backend-mt/
~/.kimi/skills/skill-backend-mt/
~/.agents/skills/skill-backend-mt/
```

The full skill folder is installed with all subfolders. The agent loads `SKILL.md` first, then reads additional files on-demand via the Read tool.

### Project-Level Agents
**Cursor, Windsurf, Cline, Roo Code, Copilot, Kilo Code, Kiro**

These agents load rules from project-level files. Run `--init` to generate auto-detected rules files in your project root:
```
.cursorrules                    → Cursor
.windsurfrules                  → Windsurf
.clinerules/backend-rules.md   → Cline
.roo/rules/backend-rules.md    → Roo Code
.github/copilot-instructions.md → Copilot
.kilocode/rules/backend-rules.md → Kilo Code
.kiro/steering/backend-rules.md  → Kiro
```

---

## Token Budget

### Per-File Token Counts

| File | Bytes | Tokens (÷4) | Priority |
|------|------:|------------:|----------|
| **SKILL.md** | 56,573 | ~14,140 | 1 — Auto-loaded |
| **shared/code-review.md** | 26,528 | ~6,630 | 3 — Auto-loaded |
| **shared/bug-detection.md** | 22,209 | ~5,550 | 3 — Auto-loaded |
| **shared/architecture-intelligence.md** | 18,494 | ~4,620 | 5 — On-demand |
| **shared/intent-analysis.md** | 17,270 | ~4,320 | 5 — On-demand (vague/compound) |
| **shared/crud-patterns.md** | 15,445 | ~3,860 | 5 — On-demand (CRUD impl) |
| **shared/prompt-engineering.md** | 13,689 | ~3,420 | 4 — Build tasks |
| **shared/error-handling-impl.md** | 11,554 | ~2,890 | 5 — On-demand (error impl) |
| **shared/api-design.md** | 11,386 | ~2,850 | 5 — On-demand |
| **shared/error-recovery.md** | 11,096 | ~2,770 | 5 — On-demand |
| **shared/testing-fixtures.md** | 10,888 | ~2,720 | 5 — On-demand (test impl) |
| **shared/database-patterns.md** | 10,789 | ~2,700 | 5 — On-demand |
| **shared/ai-dlc-workflow.md** | 9,371 | ~2,340 | 5 — On-demand |
| **shared/pagination-patterns.md** | 8,975 | ~2,240 | 5 — On-demand (pagination) |
| **shared/concurrency-patterns.md** | 8,802 | ~2,200 | 5 — On-demand (locking) |
| **shared/webhook-patterns.md** | 8,496 | ~2,120 | 5 — On-demand (webhooks) |
| **shared/logging-impl.md** | 8,320 | ~2,080 | 5 — On-demand (logging) |
| **shared/caching-implementation.md** | 8,078 | ~2,020 | 5 — On-demand (cache) |
| **shared/background-jobs.md** | 7,732 | ~1,930 | 5 — On-demand (jobs) |
| **shared/file-handling.md** | 7,646 | ~1,910 | 5 — On-demand (upload) |
| **php/laravel.md** | 9,031 | ~2,260 | 2 — If Laravel |
| **java/spring-boot.md** | 8,977 | ~2,240 | 2 — If Spring Boot |
| **python/fastapi.md** | 8,616 | ~2,150 | 2 — If FastAPI |
| **python/django.md** | 8,143 | ~2,040 | 2 — If Django |
| **nodejs/nestjs.md** | 7,922 | ~1,980 | 2 — If NestJS |
| **nodejs/nextjs.md** | 7,720 | ~1,930 | 2 — If Next.js |
| **nodejs/vuejs.md** | 7,139 | ~1,790 | 2 — If Vue.js/Nuxt |
| **others/go-ruby-rust.md** | 7,195 | ~1,800 | 2 — If Go/Ruby/Rust |
| **nodejs/express.md** | 6,257 | ~1,560 | 2 — If Express/Fastify |
| **shared/auth-security.md** | 7,469 | ~1,870 | 5 — On-demand |
| **shared/performance-optimization.md** | 7,267 | ~1,820 | 5 — On-demand |
| **shared/microservices.md** | 7,179 | ~1,800 | 5 — On-demand |
| **shared/ci-cd.md** | 7,051 | ~1,760 | 5 — On-demand |
| **shared/observability.md** | 6,100 | ~1,530 | 5 — On-demand |
| **shared/testing-strategy.md** | 5,629 | ~1,410 | 5 — On-demand |
| **shared/version-management.md** | 4,923 | ~1,230 | 5 — On-demand |
| **shared/common-pitfalls.md** | 4,443 | ~1,110 | 5 — On-demand |
| **shared/agent-rules-template.md** | 2,916 | ~730 | 6 — Init only |
| **shared/document-analysis.md** | 2,236 | ~560 | 5 — On-demand |
| **shared/claude-md-template.md** | 1,878 | ~470 | 6 — On-demand |
| **humanizer/humanizer-backend.md** | 3,923 | ~980 | 6 — On-demand |

### Loading Scenarios

| Scenario | Tokens | % of 128K | Notes |
|----------|-------:|----------:|-------|
| SKILL.md only | ~14,140 | 11.0% | Minimal |
| Core auto-load | ~29,740 | 23.2% | SKILL + bug-detection + prompt-eng + code-review |
| **Smart load** (core + 1 framework) | **~31,740** | **24.8%** | **Recommended — 75% context free** |
| Smart + 1 impl pattern | ~34,740 | 27.1% | Typical task (CRUD, pagination, etc.) |
| Smart + 2 impl patterns | ~37,740 | 29.5% | Complex task (CRUD + caching, etc.) |
| Multi-framework (3 frameworks) | ~35,740 | 27.9% | Polyglot project |
| All files | ~106,340 | 83.1% | Full audit mode |

---

## Antigravity Configuration

```yaml
skill:
  name: skill-backend-mt
  version: "1.1.0"
  author: buivietphi
  category: engineering
  tags:
    - backend
    - nestjs
    - nextjs
    - express
    - django
    - fastapi
    - spring-boot
    - laravel
    - clean-architecture
    - code-review
    - senior

  modes:
    default:
      description: "Use pre-built production patterns from 30+ backend repos"
      loads:
        # Core — always
        - SKILL.md
        - "{detected-framework}/{framework}.md"
        - shared/code-review.md
        - shared/bug-detection.md
        - shared/prompt-engineering.md
        # On-demand — add based on task
        # - shared/crud-patterns.md
        # - shared/error-handling-impl.md
        # - shared/caching-implementation.md
        # - shared/pagination-patterns.md
        # - shared/testing-fixtures.md
        # - shared/file-handling.md
        # - shared/background-jobs.md
        # - shared/webhook-patterns.md
        # - shared/concurrency-patterns.md
        # - shared/logging-impl.md

    project:
      description: "Read current project, adapt to its framework and conventions"
      argument: "project"
      loads:
        - SKILL.md (Section: Project Adaptation)
        - "{detected-framework}/{framework}.md"
        - shared/code-review.md
        - shared/bug-detection.md
        - shared/prompt-engineering.md

  framework_detection:
    nestjs:
      detect: "nest-cli.json exists OR package.json contains '@nestjs/core'"
      load: "nodejs/nestjs.md"
    nextjs:
      detect: "next.config.js/ts exists OR package.json contains 'next'"
      load: "nodejs/nextjs.md"
    express:
      detect: "package.json contains 'express' or 'fastify' (without NestJS)"
      load: "nodejs/express.md"
    vuejs:
      detect: "package.json contains 'vue' or 'nuxt'"
      load: "nodejs/vuejs.md"
    django:
      detect: "manage.py exists OR requirements.txt contains 'django'"
      load: "python/django.md"
    fastapi:
      detect: "requirements.txt contains 'fastapi' OR pyproject.toml contains 'fastapi'"
      load: "python/fastapi.md"
    spring-boot:
      detect: "pom.xml or build.gradle contains 'spring-boot'"
      load: "java/spring-boot.md"
    laravel:
      detect: "artisan exists OR composer.json contains 'laravel'"
      load: "php/laravel.md"
    go:
      detect: "go.mod exists"
      load: "others/go-ruby-rust.md"
    ruby:
      detect: "Gemfile exists AND config/routes.rb exists"
      load: "others/go-ruby-rust.md"
    rust:
      detect: "Cargo.toml exists"
      load: "others/go-ruby-rust.md"

  language_detection:
    typescript: ".ts files in src/"
    javascript: ".js files in src/"
    python: ".py files"
    java: ".java files in src/"
    php: ".php files in app/"
    go: ".go files"
    ruby: ".rb files in app/"
    rust: ".rs files in src/"

  context_budget:
    max_tokens: 118265
    smart_load_tokens: 31740
    fits_128k: "smart load only"
    fits_200k: "full load (53%)"
```

---

## Smart Loading Protocol

```
PRIORITY 1: SKILL.md (~14.1k tokens)
  → Cardinal rules (10), task router, auto-detect, quality gate, security protocol

PRIORITY 2: {framework}/{framework}.md (~1.6-2.3k tokens)
  → Framework-specific patterns, project structure, ORM, testing

PRIORITY 3: shared/code-review.md + shared/bug-detection.md (~12.2k tokens)
  → Senior review checklist, auto bug scanner

PRIORITY 4: shared/prompt-engineering.md (~3.4k tokens)
  → Auto-think templates, advanced patterns

PRIORITY 5-6: On-demand files (~0.5-4.6k tokens each)
  → Implementation patterns: crud-patterns, error-handling-impl, caching-implementation,
    pagination-patterns, testing-fixtures, file-handling, background-jobs,
    webhook-patterns, concurrency-patterns, logging-impl
  → Architecture: architecture-intelligence, api-design, database-patterns, microservices
  → Operations: error-recovery, auth-security, performance-optimization, ci-cd, observability
  → Other: intent-analysis, ai-dlc-workflow, testing-strategy, version-management, common-pitfalls
```

---

## On-Demand Load Triggers

```
USER REQUEST                    → FILES TO LOAD
──────────────────────────────────────────────────────
"Vague/informal request"        → shared/intent-analysis.md
"sửa cho đúng / fix properly"  → shared/intent-analysis.md
"Compound / multi-task request" → shared/intent-analysis.md
"Create CRUD / service"         → shared/crud-patterns.md
"Error handling / exceptions"   → shared/error-handling-impl.md
"Cache / Redis implementation"  → shared/caching-implementation.md
"Pagination / filtering / sort" → shared/pagination-patterns.md
"Test setup / factories / mock" → shared/testing-fixtures.md
"File upload / S3 / storage"    → shared/file-handling.md
"Background job / queue / CRON" → shared/background-jobs.md
"Webhook / receive / send"      → shared/webhook-patterns.md
"Race condition / locking"      → shared/concurrency-patterns.md
"Logging / correlation ID"      → shared/logging-impl.md
"Fix crash/error"               → shared/error-recovery.md
"API design / endpoint"         → shared/api-design.md
"Database / migration / schema" → shared/database-patterns.md
"Auth / security / JWT"         → shared/auth-security.md
"Microservices / service split" → shared/microservices.md
"CI/CD / Docker / deploy"       → shared/ci-cd.md
"Performance / cache / Redis"   → shared/performance-optimization.md
"Logging / metrics / tracing"   → shared/observability.md
"Write tests / testing"         → shared/testing-strategy.md
"Setup project / architecture"  → shared/architecture-intelligence.md
"Add package / library"         → shared/version-management.md
"Big feature / multi-module"    → shared/ai-dlc-workflow.md
"Read API spec / ERD / doc"     → shared/document-analysis.md
"Weird issue / not sure why"    → shared/common-pitfalls.md
"Code audit / review"           → shared/code-review.md + shared/common-pitfalls.md
```

---

## Metadata

```json
{
  "id": "skill-backend-mt",
  "name": "skill-backend-mt",
  "version": "1.1.0",
  "author": "buivietphi",
  "category": "engineering",
  "description": "Master Senior Backend Engineer. Patterns from 30+ production repos (200k+ GitHub stars: NestJS, Next.js, Fastify, Django, FastAPI, Spring Boot, Laravel, Express, Prisma, TypeORM). Cardinal rules, self-critique loops, leverage pyramid, verification-first, decision matrix, codebase scan strategy, grounded code review (anti-false-positive), intent analysis, spec interpretation, implementation patterns. NestJS, Next.js, Express, Vue.js, Django, FastAPI, Spring Boot, Laravel, Go, Ruby, Rust.",
  "risk": "low",
  "source": "buivietphi (MIT)",
  "frameworks": ["nestjs", "nextjs", "express", "vuejs", "django", "fastapi", "spring-boot", "laravel", "go", "ruby", "rust"],
  "languages": ["typescript", "javascript", "python", "java", "php", "go", "ruby", "rust"],
  "agents": ["claude-code", "cline", "roo-code", "cursor", "windsurf", "copilot", "codex", "gemini", "kimi", "kilo-code", "kiro", "antigravity"]
}
```
