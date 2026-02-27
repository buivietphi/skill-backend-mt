# Microservices Architecture

> Service decomposition, messaging patterns, resilience, anti-patterns.

---

## When to Use Microservices

```
✅ USE WHEN:
  - Team size > 20 (independent team ownership)
  - Different services need different scaling
  - Different services need different tech stacks
  - Clear bounded contexts in the domain
  - Need independent deployment cycles

⛔ AVOID WHEN:
  - Small team (< 10 people)
  - Simple CRUD application
  - Unclear domain boundaries
  - No DevOps maturity (CI/CD, monitoring, containers)
  - Startup MVP (start monolith, extract later)

PROGRESSION:
  Monolith → Modular Monolith → Microservices
  ⛔ NEVER jump straight to microservices
```

---

## Service Decomposition

### Bounded Context (DDD)
```
IDENTIFY BOUNDARIES BY:
  1. Business capability (Orders, Payments, Users, Inventory)
  2. Data ownership (each service owns its data)
  3. Team ownership (one team = one or few services)
  4. Deployment independence (can deploy without coordinating)

EXAMPLE: E-Commerce
  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐
  │  Users   │  │  Orders  │  │ Payments  │  │ Inventory │
  │ Service  │  │ Service  │  │  Service  │  │  Service  │
  ├──────────┤  ├──────────┤  ├───────────┤  ├───────────┤
  │ Users DB │  │ Orders DB│  │Payments DB│  │Inventory  │
  └──────────┘  └──────────┘  └───────────┘  │    DB     │
                                              └───────────┘

RULE: Each service has its OWN database. No shared databases.
```

### Service Size
```
TOO SMALL:  A service with 1 endpoint and 50 lines of code
TOO LARGE:  A service with 100 endpoints and its own internal modules
JUST RIGHT: A service that one team can understand, develop, and deploy

HEURISTIC: If a service needs > 5 minutes to explain, it's too big.
```

---

## Communication Patterns

### Synchronous (Request/Response)
```
REST (HTTP):
  ✅ Simple, well-understood
  ✅ Good for external-facing APIs
  ⛔ Creates temporal coupling (caller waits)

gRPC:
  ✅ High performance (binary protocol)
  ✅ Streaming support
  ✅ Strong typing (proto definitions)
  ⛔ Not browser-friendly

RULE: Use REST for external, gRPC for internal service-to-service.
```

### Asynchronous (Event-Driven)
```
MESSAGE QUEUE (point-to-point):
  Producer → Queue → Consumer
  Tools: RabbitMQ, SQS, Redis

EVENT STREAM (pub/sub):
  Producer → Topic → Multiple Consumers
  Tools: Kafka, SNS, Redis Pub/Sub, EventBridge

USE ASYNC WHEN:
  ✅ Sender doesn't need immediate response
  ✅ Operation is expensive (email, PDF, processing)
  ✅ Need to decouple services
  ✅ Need event replay capability (Kafka)

EVENT FORMAT:
  {
    "eventId": "evt_123",
    "eventType": "order.placed",
    "timestamp": "2024-01-15T10:30:00Z",
    "payload": { "orderId": "ord_456", "userId": "usr_789", "total": 99.99 },
    "metadata": { "correlationId": "req_abc", "source": "order-service" }
  }
```

---

## Saga Pattern (Distributed Transactions)

### Orchestration (Central Coordinator)
```
  Order Saga Orchestrator
    1. → Create Order (Order Service)
    2. → Reserve Inventory (Inventory Service)
    3. → Process Payment (Payment Service)
    4. → Confirm Order (Order Service)

  ON FAILURE at step 3:
    3. ← Refund Payment (compensating)
    2. ← Release Inventory (compensating)
    1. ← Cancel Order (compensating)

PROS: Clear flow, easy to debug
CONS: Single point of failure (orchestrator)
```

### Choreography (Event-Driven)
```
  Order Service → publishes "OrderCreated"
    → Inventory Service listens → reserves stock → publishes "StockReserved"
      → Payment Service listens → processes payment → publishes "PaymentProcessed"
        → Order Service listens → confirms order → publishes "OrderConfirmed"

PROS: No single point of failure, loosely coupled
CONS: Harder to debug, distributed flow
```

---

## Resilience Patterns

### Circuit Breaker
```
STATES:
  CLOSED  → Normal operation, requests pass through
  OPEN    → Service is down, fail fast (don't send requests)
  HALF-OPEN → Test if service recovered (send one request)

THRESHOLDS:
  Failure count: 5 failures in 60 seconds → OPEN
  Open duration: 30 seconds → HALF-OPEN
  Success in HALF-OPEN: 1 success → CLOSED

LIBRARIES:
  Node.js: opossum
  Python:  pybreaker
  Java:    resilience4j
  Go:      gobreaker
```

### Retry with Exponential Backoff
```
  Attempt 1: Immediate
  Attempt 2: Wait 1s
  Attempt 3: Wait 2s
  Attempt 4: Wait 4s
  Attempt 5: Wait 8s (give up after this)

  Add jitter: delay = baseDelay * 2^attempt + random(0, 1000ms)

RULES:
  ✅ Only retry on transient errors (503, timeout, connection reset)
  ⛔ NEVER retry on 400/401/403/404 (client errors)
  ⛔ NEVER retry on 409 (conflict — data already changed)
  ✅ Set max retries (3-5)
  ✅ Ensure operation is idempotent before retrying
```

### Bulkhead Isolation
```
Limit concurrent requests per external dependency:
  Payment API:     max 10 concurrent calls
  Email Service:   max 5 concurrent calls
  Search Service:  max 20 concurrent calls

If pool exhausted → fail fast instead of queuing

PREVENTS: One slow dependency from consuming all resources
```

### Timeout
```
EVERY external call MUST have a timeout:
  Database queries:     5 seconds
  HTTP to services:     10 seconds
  HTTP to third-party:  30 seconds
  Background jobs:      5 minutes

⛔ NEVER make an external call without a timeout
```

---

## API Gateway Pattern

```
        ┌───────────┐
Client →│   API     │→ User Service
        │  Gateway  │→ Order Service
        │           │→ Payment Service
        └───────────┘

RESPONSIBILITIES:
  ✅ Authentication/Authorization
  ✅ Rate limiting
  ✅ Request routing
  ✅ Load balancing
  ✅ SSL termination
  ✅ Request/response transformation
  ✅ Caching
  ✅ Logging and monitoring

TOOLS: Kong, Nginx, AWS API Gateway, Traefik, Envoy
```

---

## Anti-Patterns

```
1. DISTRIBUTED MONOLITH
   ❌ Services can't deploy independently
   ❌ Services share database
   FIX: Each service owns its data, async communication

2. CHATTY MICROSERVICES
   ❌ 10+ network calls to serve one request
   FIX: Aggregate data at API gateway, use BFF pattern

3. SHARED DATABASE
   ❌ Multiple services read/write same tables
   FIX: Each service has its own DB, sync via events

4. NANO-SERVICES
   ❌ Too many tiny services (one endpoint each)
   FIX: Merge related services into one bounded context

5. LACK OF OBSERVABILITY
   ❌ Can't trace a request across services
   FIX: Distributed tracing (OpenTelemetry), correlation IDs

6. SYNCHRONOUS CHAINS
   ❌ A → B → C → D (if D fails, A fails)
   FIX: Use async events, circuit breakers, fallbacks
```
