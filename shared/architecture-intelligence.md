# Backend Architecture Intelligence

> Production patterns from 30+ top repos. Clean Architecture, DDD, Hexagonal, CQRS.

---

## Reference Repositories

```
REPOSITORY                           STARS    PATTERNS
───────────────────────────────────────────────────────────────
vercel/next.js                       130k+    App Router, API routes, middleware, SSR
goldbergyoni/nodebestpractices       105k+    80+ Node.js best practices, component-based
gothinkster/realworld                82k+     Same app in every framework (reference)
django/django                        82k+     ORM, admin, signals, middleware
fastapi/fastapi                      80k+     Async, Pydantic, dependency injection
gin-gonic/gin                        80k+     HTTP router, middleware, binding
laravel/laravel                      79k+     Eloquent, service container, middleware
spring-projects/spring-boot          76k+     Auto-config, starter deps, actuator
nestjs/nest                          70k+     Module system, DI, decorators, guards
expressjs/express                    66k+     Middleware pipeline, routing
rails/rails                          56k+     MVC, Active Record, concerns
golang-standards/project-layout      55k+     Go standard layout (cmd/internal/pkg/)
fastapi/full-stack-fastapi-template  41k+     Full-stack template, SQLModel, Alembic
prisma/prisma                        40k+     Schema-first ORM, migrations
typeorm/typeorm                      34k+     Entity decorators, repositories
tokio-rs/axum                        20k+     Tower middleware, extractors
evrone/go-clean-template             7k+      Clean Architecture in Go
santiq/bulletproof-nodejs            5.7k+    3-layer architecture, loaders, DI
brocoders/nestjs-boilerplate         4.2k+    Multi-DB adapter, code generation
```

---

## Architecture Patterns

### 1. Clean Architecture (Recommended Default)

```
DEPENDENCY RULE: outer layers depend on inner layers, NEVER reverse.

┌─────────────────────────────────────────────┐
│  Presentation (Controllers, Routes, DTOs)    │  ← Handles HTTP
├─────────────────────────────────────────────┤
│  Application (Services, Use Cases)           │  ← Business logic
├─────────────────────────────────────────────┤
│  Domain (Entities, Value Objects, Interfaces)│  ← Core domain
├─────────────────────────────────────────────┤
│  Infrastructure (Repositories, DB, External) │  ← Data access
└─────────────────────────────────────────────┘
```

**Production Folder Structure (Module-Based):**
```
src/
├── modules/
│   ├── users/
│   │   ├── users.controller.ts       ← HTTP handlers
│   │   ├── users.service.ts          ← Business logic
│   │   ├── users.repository.ts       ← Data access
│   │   ├── users.module.ts           ← Module registration
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts    ← Input validation
│   │   │   └── update-user.dto.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts        ← Database schema
│   │   └── tests/
│   │       ├── users.service.spec.ts
│   │       └── users.controller.spec.ts
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── auth.module.ts
│   └── [feature]/
│       └── ... (same structure)
├── common/
│   ├── decorators/                    ← Custom decorators
│   ├── filters/                       ← Exception filters
│   ├── guards/                        ← Shared guards
│   ├── interceptors/                  ← Logging, transform
│   ├── middleware/                     ← Request processing
│   ├── pipes/                         ← Validation pipes
│   └── interfaces/                    ← Shared interfaces
├── config/
│   ├── database.config.ts
│   ├── app.config.ts
│   └── auth.config.ts
├── database/
│   ├── migrations/
│   └── seeds/
├── app.module.ts
└── main.ts
```

### 2. Hexagonal Architecture (Ports & Adapters)

```
                    ┌──────────────┐
  HTTP ────────────▸│              │
  gRPC ────────────▸│    PORTS     │◂──────── Database
  CLI  ────────────▸│  (Interfaces)│◂──────── Cache
  Queue ───────────▸│              │◂──────── Email
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   DOMAIN     │
                    │  (Pure Logic) │
                    └──────────────┘
```

**When to use:** Complex domain logic, multiple entry points (HTTP + queue + CLI), high testability requirements.

### 3. Domain-Driven Design (DDD)

```
src/
├── bounded-contexts/
│   ├── orders/
│   │   ├── domain/
│   │   │   ├── entities/          ← Order, OrderItem
│   │   │   ├── value-objects/     ← Money, Address
│   │   │   ├── events/           ← OrderPlaced, OrderShipped
│   │   │   ├── repositories/     ← IOrderRepository (interface)
│   │   │   └── services/         ← OrderDomainService
│   │   ├── application/
│   │   │   ├── commands/         ← PlaceOrderCommand
│   │   │   ├── queries/          ← GetOrderQuery
│   │   │   └── handlers/         ← PlaceOrderHandler
│   │   └── infrastructure/
│   │       ├── persistence/      ← OrderRepository (implementation)
│   │       └── messaging/        ← OrderEventPublisher
│   └── payments/
│       └── ... (same structure)
```

**When to use:** Complex business domains, multiple bounded contexts, event-driven systems.

### 4. CQRS (Command Query Responsibility Segregation)

```
Command Side (Write):                Query Side (Read):
  Request → Command → Handler         Request → Query → Handler
    → Domain Logic → Write DB            → Read DB/Cache → Response
    → Publish Event

WHEN TO USE:
  ✅ Read and write models differ significantly
  ✅ High read:write ratio (e.g., 100:1)
  ✅ Complex business rules on write side
  ✅ Separate scaling needs for reads vs writes

WHEN TO AVOID:
  ⛔ Simple CRUD applications
  ⛔ Small team / simple domain
  ⛔ Eventual consistency is unacceptable
```

---

### 5. Vertical Slice Architecture

```
Organize by FEATURE SLICE, not by technical layer.
Each slice is a fully independent vertical cut through ALL layers.

src/
├── features/
│   ├── create-order/
│   │   ├── create-order.handler.ts      ← Use case (command handler)
│   │   ├── create-order.dto.ts          ← Input validation
│   │   ├── create-order.route.ts        ← HTTP endpoint
│   │   └── create-order.test.ts         ← Test for this slice
│   ├── get-order/
│   │   ├── get-order.handler.ts
│   │   ├── get-order.route.ts
│   │   └── get-order.test.ts
│   └── cancel-order/
│       └── ...
├── shared/
│   ├── database/                         ← Shared infrastructure
│   ├── middleware/
│   └── entities/                         ← Shared domain models
└── app.ts

WHEN TO USE:
  ✅ Large teams (each slice = independent PR, no merge conflicts)
  ✅ Features rarely share logic across slices
  ✅ Microservice-ready (each slice can become its own service later)

WHEN TO AVOID:
  ⛔ Highly shared domain logic (DDD is better)
  ⛔ Small CRUD apps (over-engineering)

KEY DIFFERENCE from Clean Architecture:
  Clean: src/modules/orders/ → controller + service + repository (all CRUD in one module)
  VSA:   src/features/create-order/ → ONE operation per folder (single responsibility)
```

### 6. Go Standard Layout

```
Go projects follow a community-standard layout (55k+ stars):

cmd/                      ← Application entry points (one per binary)
  ├── api/main.go          ← API server binary
  ├── worker/main.go       ← Background worker binary
  └── migrate/main.go      ← Migration CLI binary
internal/                 ← PRIVATE code (Go compiler enforces — can't be imported externally)
  ├── controller/          ← Entry points per transport
  │   ├── http/v1/          ← REST handlers
  │   ├── grpc/v1/          ← gRPC handlers
  │   └── amqp/v1/          ← Message queue handlers
  ├── entity/              ← Domain entities
  ├── usecase/             ← Business logic (called by any controller)
  └── repo/                ← Repository implementations
      ├── postgres/         ← PostgreSQL adapter
      └── redis/            ← Redis adapter
pkg/                      ← PUBLIC reusable packages (can be imported by other repos)
  ├── httpserver/
  ├── logger/
  └── postgres/
api/                      ← API definitions (proto files, OpenAPI specs)
configs/                  ← Configuration files
migrations/               ← Database migrations
deployments/              ← Docker, K8s, terraform

KEY PATTERNS:
  - cmd/ allows ONE repo → MULTIPLE binaries (API + worker + CLI)
  - internal/ is COMPILER-ENFORCED privacy (no other language has this)
  - Multi-transport: REST + gRPC + AMQP controllers → same usecase layer
  - pkg/ = reusable libraries, internal/ = app-specific code
```

---

## Architecture Decision Matrix

```
PROJECT TYPE              → RECOMMENDED ARCHITECTURE
─────────────────────────────────────────────────────
Simple CRUD API            → Layer-based (controllers + services + repositories)
Medium SaaS product        → Clean Architecture (module-based)
Complex enterprise         → DDD + Hexagonal
High-traffic read-heavy    → CQRS + Event Sourcing
Microservices system       → DDD bounded contexts + Event-Driven
Startup MVP                → Simple layer-based (don't over-engineer)
Monolith to microservices  → Modular Monolith first → extract services later
Large team, many features  → Vertical Slice Architecture
Go backend                 → Go Standard Layout (cmd/ + internal/ + pkg/)
Monorepo multi-service     → apps/ + libs/ pattern (shared contracts)
```

---

## Cross-Framework Patterns

### 1. Repository Pattern
```
ALL frameworks benefit from separating data access:
  Controller → Service → Repository → Database

  Repository handles: queries, transactions, caching
  Service handles: business logic, validation, orchestration
  Controller handles: HTTP concerns, request/response mapping
```

### 2. DTO/Schema Validation Pattern
```
ALWAYS validate at the boundary:
  NestJS   → class-validator decorators on DTO classes
  Express  → Zod/Joi schemas in middleware
  FastAPI  → Pydantic models as function parameters
  Django   → Serializers (DRF) or Forms
  Spring   → @Valid + Jakarta Bean Validation
  Laravel  → Form Request classes
```

### 3. Error Handling Pattern
```
EVERY framework needs:
  1. Global exception handler/filter
  2. Domain-specific exception classes
  3. Consistent error response format:
     { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
  4. Logging with context (request ID, user ID)
  5. Different behavior per environment (dev: stack trace, prod: sanitized)
```

### 4. Configuration Pattern
```
EVERY framework needs:
  1. Environment-based config (dev/staging/prod)
  2. Validation at startup (fail fast if config missing)
  3. Type-safe config objects (not raw process.env everywhere)
  4. Secrets from env vars or secret manager (NEVER in code)
```

### 5. Health Check Pattern
```
EVERY service needs:
  GET /health → { "status": "ok", "version": "1.0.0", "uptime": 12345 }
  GET /health/ready → checks DB connection, Redis, external deps

  Used by: load balancers, K8s readiness probes, monitoring
```

### 6. Background Job / Worker Architecture
```
EVERY non-trivial backend needs async processing:

FOLDER STRUCTURE:
  src/
  ├── jobs/                          ← Job definitions
  │   ├── send-email.job.ts          ← One file per job type
  │   ├── process-payment.job.ts
  │   └── generate-report.job.ts
  ├── workers/                       ← Worker entry points (if separate process)
  │   └── queue-worker.ts
  └── queues/                        ← Queue configuration
      └── queue.config.ts

COMMON STACKS:
  Node.js:  BullMQ (Redis) / Agenda (MongoDB) / pg-boss (PostgreSQL)
  Python:   Celery (Redis/RabbitMQ) / RQ (Redis) / Dramatiq
  Java:     Spring @Async / Spring Batch / Quartz Scheduler
  Laravel:  Queue (Redis/SQS/database) / Scheduler
  Go:       Asynq (Redis) / Machinery / River (PostgreSQL)

PATTERN:
  HTTP request → create job (enqueue) → return immediately (202 Accepted)
  Worker process → dequeue → execute → update status
  Client polls or receives webhook/WebSocket notification

WHEN TO USE:
  ✅ Email/notification sending
  ✅ Report generation, data export
  ✅ Image/video processing
  ✅ Payment processing (async confirmation)
  ✅ Any operation > 5 seconds
  ⛔ Simple CRUD (don't over-engineer)
```

### 7. Loader / Bootstrap Pattern
```
Structured app initialization instead of one giant main.ts:

src/
├── loaders/
│   ├── index.ts              ← Orchestrates all loaders in order
│   ├── express.loader.ts     ← Express/Fastify setup + middleware
│   ├── database.loader.ts    ← DB connection + migrations
│   ├── redis.loader.ts       ← Redis connection
│   ├── di.loader.ts          ← Dependency injection container
│   ├── cron.loader.ts        ← Cron job registration
│   └── routes.loader.ts      ← Route registration
└── main.ts                   ← Just calls loadApp()

BENEFITS:
  ✅ Each loader can be tested independently
  ✅ Clear initialization order (DB before routes)
  ✅ Easy to add/remove services (just add/remove loader)
  ✅ Graceful shutdown per loader (reverse order)

WHEN TO USE:
  ✅ App has 3+ external dependencies (DB, Redis, queue, email, etc.)
  ✅ Startup has ordering requirements
  ⛔ Simple single-DB apps (just use main.ts)
```

### 8. Outbox + Inbox Pattern (Reliable Events)
```
PROBLEM: Writing to DB + publishing event is NOT atomic.
  DB write succeeds → event publish fails → data inconsistent

OUTBOX PATTERN (publisher side):
  1. Write data + event to outbox table in SAME transaction
  2. Background worker polls outbox table → publishes to queue
  3. Mark outbox entry as published

  CREATE TABLE outbox (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,     -- 'order.created'
    payload JSONB NOT NULL,               -- { orderId, amount, ... }
    published_at TIMESTAMPTZ,             -- NULL = not yet published
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

INBOX PATTERN (consumer side):
  1. Receive event → check inbox table for duplicate (idempotency)
  2. If new → process + insert into inbox in SAME transaction
  3. If duplicate → skip (already processed)

  CREATE TABLE inbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL, -- dedup key
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
  );

WHEN TO USE:
  ✅ Microservices that need reliable event delivery
  ✅ Financial/payment operations (at-least-once guarantee)
  ✅ Any cross-service data sync
  ⛔ Single-service apps (just use DB transactions)
```

### 9. Monorepo apps/ + libs/ Pattern
```
Multiple services + shared code in one repository:

monorepo/
├── apps/
│   ├── api/                  ← Main API service
│   │   ├── src/
│   │   └── package.json
│   ├── worker/               ← Background worker service
│   │   ├── src/
│   │   └── package.json
│   └── admin/                ← Admin API service
│       ├── src/
│       └── package.json
├── libs/
│   ├── common/               ← Shared utilities, types, constants
│   │   └── src/
│   ├── contracts/            ← Shared DTOs, interfaces, event types
│   │   └── src/
│   ├── database/             ← Shared DB entities, migrations
│   │   └── src/
│   └── auth/                 ← Shared auth logic
│       └── src/
├── package.json              ← Root workspace config
└── turbo.json / nx.json      ← Monorepo tool config

TOOLS:
  Node.js:  Turborepo / Nx / pnpm workspaces / yarn workspaces
  Python:   Pants / Bazel
  Java:     Multi-module Maven / Gradle
  Go:       Go workspace (go.work)

WHEN TO USE:
  ✅ Multiple services share types/contracts
  ✅ Team wants atomic cross-service changes
  ✅ Shared database entities across services
  ⛔ Services owned by completely different teams
  ⛔ Services in different languages (polyglot → separate repos)
```
