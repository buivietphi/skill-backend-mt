# @buivietphi/skill-backend-mt

> **Master Senior Backend Engineer** — AI agent skill with production patterns from 30+ top repos (200k+ GitHub stars).
> Trained from research of top 53k+ star skill repos + system prompts from 7 major AI tools.

Works with: **Claude Code · Cline · Roo Code · Cursor · Windsurf · Copilot · Codex · Gemini · Kimi · Kilo Code · Kiro · Antigravity**

Supports: **NestJS · Next.js · Express · Fastify · Vue.js · Nuxt · Django · FastAPI · Flask · Spring Boot · Laravel · Go · Ruby on Rails · Rust**

---

## Install

```bash
# Interactive (checkbox UI — pick your agents)
npx @buivietphi/skill-backend-mt

# Specific agent
npx @buivietphi/skill-backend-mt --claude
npx @buivietphi/skill-backend-mt --codex
npx @buivietphi/skill-backend-mt --gemini
npx @buivietphi/skill-backend-mt --all

# Project-level rules (Cursor, Windsurf, Cline, etc.)
npx @buivietphi/skill-backend-mt --init           # Interactive
npx @buivietphi/skill-backend-mt --init cursor     # Just .cursorrules
npx @buivietphi/skill-backend-mt --init all        # All agents
```

### What Happens

```
~/.claude/skills/
  └── skill-backend-mt/
      ├── SKILL.md              ← Entry point (auto-loaded)
      ├── AGENTS.md
      ├── nodejs/
      │   ├── nestjs.md
      │   ├── nextjs.md
      │   ├── express.md
      │   └── vuejs.md
      ├── python/
      │   ├── fastapi.md
      │   └── django.md
      ├── java/
      │   └── spring-boot.md
      ├── php/
      │   └── laravel.md
      ├── others/
      │   └── go-ruby-rust.md
      └── shared/               ← On-demand (18 files)
```

---

## Usage

### Default Mode (Pre-Built Patterns)
```
@skill-backend-mt
> "Create a user CRUD with JWT auth"
```
Uses production patterns from 30+ repos. Best for learning, new projects, generic advice.

### Project Mode (Adapt to Your Codebase)
```
@skill-backend-mt project
> "Add an orders module"
```
Reads YOUR project first, clones existing patterns. Best for existing codebases.

---

## What's Included

### Architecture Patterns
- Clean Architecture, Hexagonal, DDD, CQRS
- Module-based vs Layer-based structure
- Monolith vs Microservices decision matrix
- Reference repos: NestJS (70k+), Next.js (130k+), FastAPI (80k+), Spring Boot (76k+), Laravel (79k+), Django (82k+)

### API Design
- REST conventions (resources, verbs, status codes)
- GraphQL schema design + N+1 prevention
- gRPC proto patterns
- WebSocket real-time patterns
- Pagination (cursor-based vs offset)

### Security (OWASP Top 10)
- JWT + refresh token rotation
- OAuth 2.0 / OpenID Connect
- RBAC / ABAC authorization
- SQL injection, XSS, CSRF prevention
- Rate limiting, CORS, secret management

### Database & Performance
- ORM patterns (Prisma, TypeORM, SQLAlchemy, Eloquent, Spring Data, Mongoose)
- Migration best practices
- N+1 query detection and fix
- Multi-level caching (Redis, in-memory, CDN)
- Connection pooling, query optimization

### Testing & CI/CD
- Testing pyramid (70% unit / 20% integration / 10% E2E)
- Per-framework testing (Jest, pytest, JUnit, PHPUnit)
- Docker multi-stage builds
- GitHub Actions CI templates
- Deployment strategies (blue-green, canary, rolling)

### Advanced AI Patterns
- Cardinal Rules (10 inviolable rules for code quality)
- Self-Critique Loop (re-read and verify before presenting)
- Context Staleness Rule (re-read files after 5 messages)
- Verification-First Pattern (read before suggesting)
- Assumption-Driven Progress (don't block on non-critical choices)
- Negative Space Pattern (check what you didn't write)
- Batched Operations (group related file creation)
- Error Recovery with Escalation (4-level escalation)
- Leverage Pyramid (40% research, 30% planning, 20% implement, 10% verify)
- Session State Tracking (never lose track of multi-file tasks)
- Grounding Protocol (anti-hallucination with source hierarchy)
- AI-DLC Workflow (4 Hats for complex features)
- Multi-Part Execution Protocol (discover all locations → work plan → checkpoint)
- Discovery-Execute Workflow (for "fix all X" / broad requests)

### Intelligent Prompt Engineering
- Auto-think templates (Fix/Debug, Build/Create, Review, Refactor, Multi-Part)
- Source verification checklist
- Context-needed declarations
- Patterns learned from: Anthropic, Cursor, Lovable, Manus, Windsurf, Kiro, Replit system prompts

---

## Token Budget

| Scenario | Tokens | % of 128K |
|----------|-------:|----------:|
| SKILL.md only | ~12,970 | 10.1% |
| Core auto-load | ~28,080 | 21.9% |
| **Smart load** (core + 1 framework) | **~30,080** | **23.5%** |
| Multi-framework (3 frameworks) | ~34,080 | 26.6% |
| Full load (all files) | ~62,500 | 48.8% |

**Smart loading uses only 23.5% of context** — 76% free for actual code work.

### Per-File Breakdown (bytes ÷ 4)

| File | Bytes | Tokens |
|------|------:|-------:|
| SKILL.md | 51,877 | ~12,970 |
| shared/code-review.md | 26,528 | ~6,630 |
| shared/bug-detection.md | 22,209 | ~5,550 |
| shared/architecture-intelligence.md | 18,494 | ~4,620 |
| shared/api-design.md | 11,386 | ~2,850 |
| shared/error-recovery.md | 11,096 | ~2,770 |
| shared/database-patterns.md | 10,789 | ~2,700 |
| shared/prompt-engineering.md | 11,718 | ~2,930 |
| php/laravel.md | 9,031 | ~2,260 |
| java/spring-boot.md | 8,977 | ~2,240 |
| python/fastapi.md | 8,616 | ~2,150 |
| python/django.md | 8,143 | ~2,040 |
| nodejs/nestjs.md | 7,922 | ~1,980 |
| nodejs/nextjs.md | 7,720 | ~1,930 |
| shared/auth-security.md | 7,469 | ~1,870 |
| shared/performance-optimization.md | 7,267 | ~1,820 |
| others/go-ruby-rust.md | 7,195 | ~1,800 |
| shared/microservices.md | 7,179 | ~1,800 |
| nodejs/vuejs.md | 7,139 | ~1,790 |
| shared/ci-cd.md | 7,051 | ~1,760 |
| nodejs/express.md | 6,257 | ~1,560 |
| shared/observability.md | 6,100 | ~1,530 |
| shared/testing-strategy.md | 5,629 | ~1,410 |
| shared/version-management.md | 4,923 | ~1,230 |
| shared/ai-dlc-workflow.md | 9,371 | ~2,340 |
| shared/common-pitfalls.md | 4,443 | ~1,110 |
| humanizer/humanizer-backend.md | 3,923 | ~980 |
| shared/agent-rules-template.md | 2,916 | ~730 |
| shared/document-analysis.md | 2,236 | ~560 |
| shared/claude-md-template.md | 1,878 | ~470 |

---

## Supported Agents

| Agent | Type | Install |
|-------|------|---------|
| Claude Code | Skills directory | `--claude` |
| Codex | Skills directory | `--codex` |
| Gemini CLI | Skills directory | `--gemini` |
| Kimi | Skills directory | `--kimi` |
| Antigravity | Skills directory | `--antigravity` |
| Cursor | Project-level | `--init cursor` |
| Windsurf | Project-level | `--init windsurf` |
| Cline | Project-level | `--init cline` |
| Roo Code | Project-level | `--init roocode` |
| Copilot | Project-level | `--init copilot` |
| Kilo Code | Project-level | `--init kilocode` |
| Kiro | Project-level | `--init kiro` |

---

## Companion Skill

**humanizer-backend** is auto-installed alongside the main skill. It humanizes AI-generated code comments, API docs, and error messages.

```
@humanizer-backend
> "Humanize this API documentation"
```

---

## License

MIT
