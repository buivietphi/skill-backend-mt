# Observability Patterns

> Structured logging, distributed tracing, metrics, OpenTelemetry.

---

## The Three Pillars + Sessions

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐
│  LOGS   │  │ TRACES  │  │ METRICS │  │ SESSIONS │
│ (What)  │  │ (Where) │  │ (How)   │  │ (Who)    │
└─────────┘  └─────────┘  └─────────┘  └──────────┘
```

---

## Structured Logging

### Format
```json
{
  "level": "info",
  "message": "User created successfully",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "user-service",
  "requestId": "req_abc123",
  "userId": "usr_def456",
  "duration": 45,
  "metadata": {
    "email": "user@example.com",
    "method": "POST",
    "path": "/api/users",
    "statusCode": 201
  }
}
```

### Log Levels
```
FATAL  → Application cannot continue. Alert immediately.
ERROR  → Operation failed. Requires investigation.
WARN   → Unexpected but recoverable. Monitor.
INFO   → Important business events. Audit trail.
DEBUG  → Developer details. OFF in production.
TRACE  → Extremely detailed. OFF in production.

PRODUCTION: INFO + WARN + ERROR + FATAL
DEVELOPMENT: DEBUG + INFO + WARN + ERROR + FATAL
```

### Logging Rules
```
✅ ALWAYS log:
  - Request received (method, path, request ID)
  - Request completed (status code, duration)
  - Authentication events (login, logout, failed attempts)
  - Business events (order created, payment processed)
  - Errors with full context (stack trace, request data)

⛔ NEVER log:
  - Passwords, tokens, API keys
  - Full credit card numbers
  - Personal data (SSN, medical records)
  - Request/response bodies with sensitive fields
  - Debug output in production
```

### Correlation IDs
```
FLOW:
  1. Generate unique requestId for each incoming request
  2. Pass requestId through all internal service calls
  3. Include requestId in every log entry
  4. Return requestId in response headers (X-Request-ID)

IMPLEMENTATION:
  - Middleware generates ID on request entry
  - Store in AsyncLocalStorage (Node.js) / ContextVar (Python) / ThreadLocal (Java)
  - All log calls automatically include the ID
  - Propagate via HTTP headers between services
```

---

## Distributed Tracing (OpenTelemetry)

### Concepts
```
TRACE:  Complete journey of a request across services
SPAN:   Single operation within a trace (DB query, HTTP call, processing)
PARENT: The span that triggered this span

TRACE: user-request
  ├── SPAN: API Gateway (10ms)
  ├── SPAN: Auth Service (5ms)
  ├── SPAN: User Service (45ms)
  │   ├── SPAN: DB Query (15ms)
  │   └── SPAN: Cache Check (2ms)
  └── SPAN: Notification Service (100ms)
      └── SPAN: Email Send (80ms)
```

### Setup (Node.js + OpenTelemetry)
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'user-service',
});

sdk.start();
```

### Setup (Python / FastAPI + OpenTelemetry)
```python
# tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

def setup_tracing(app, engine):
    provider = TracerProvider()
    exporter = OTLPSpanExporter(endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    # Auto-instrument FastAPI, SQLAlchemy, HTTP client
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    HTTPXClientInstrumentor().instrument()
```

### Setup (Go + OpenTelemetry)
```go
// tracing/tracing.go
func InitTracer(serviceName string) (*sdktrace.TracerProvider, error) {
    exporter, err := otlptracegrpc.New(context.Background(),
        otlptracegrpc.WithEndpoint(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
        otlptracegrpc.WithInsecure(),
    )
    if err != nil { return nil, err }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
        )),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}
```

### Jaeger / Tempo (Docker Compose for local dev)
```yaml
# docker-compose.yml — add to existing services
  jaeger:
    image: jaegertracing/all-in-one:1.53
    ports:
      - "16686:16686"   # Jaeger UI
      - "4317:4317"     # OTLP gRPC
      - "4318:4318"     # OTLP HTTP
    environment:
      COLLECTOR_OTLP_ENABLED: true
```

### Custom Span Example
```typescript
// Add custom spans for business-critical operations
const tracer = trace.getTracer('payment-service');

async function processPayment(orderId: string, amount: number) {
  return tracer.startActiveSpan('process-payment', async (span) => {
    span.setAttribute('order.id', orderId);
    span.setAttribute('payment.amount', amount);
    try {
      const result = await stripeClient.charge(amount);
      span.setAttribute('payment.status', result.status);
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Key Span Attributes
```
http.method:       GET, POST, etc.
http.url:          /api/users/123
http.status_code:  200
db.system:         postgresql
db.statement:      SELECT * FROM users WHERE id = $1
db.duration:       15ms
error:             true/false
error.message:     "Connection refused"
```

---

## Metrics

### RED Method (for services)
```
RATE:      Requests per second
ERRORS:    Error rate (% of requests that fail)
DURATION:  Response time distribution (p50, p95, p99)

These 3 metrics tell you if your service is healthy.
```

### USE Method (for resources)
```
UTILIZATION:  % of resource in use (CPU, memory, connections)
SATURATION:   Queue depth, backpressure
ERRORS:       Resource errors (OOM, connection refused)
```

### Key Metrics to Track
```
APPLICATION:
  - Request rate (requests/second)
  - Error rate (errors/second, error %)
  - Response time (p50, p95, p99)
  - Active connections
  - Queue depth (if using message queues)

DATABASE:
  - Query duration (p95)
  - Connection pool usage (active/max)
  - Slow query count
  - Transaction rate
  - Replication lag

INFRASTRUCTURE:
  - CPU usage (%)
  - Memory usage (%)
  - Disk I/O
  - Network I/O
  - Container restart count
```

---

## Health Check Endpoints

```
GET /health
  → Basic liveness check
  → { "status": "ok", "version": "1.0.0", "uptime": 12345 }
  → Used by: K8s liveness probe

GET /health/ready
  → Readiness check (verify dependencies)
  → Check: database connection, Redis, external services
  → { "status": "ok", "checks": { "database": "ok", "redis": "ok", "storage": "ok" } }
  → Used by: K8s readiness probe, load balancer

GET /health/startup
  → Startup check (one-time initialization)
  → Check: migrations applied, cache warmed
  → Used by: K8s startup probe
```

---

## Alerting Rules

```
CRITICAL (page on-call):
  - Error rate > 5% for 5 minutes
  - p99 latency > 5s for 5 minutes
  - Health check failing for 2 minutes
  - Database connection pool exhausted
  - Disk usage > 90%

WARNING (notify in channel):
  - Error rate > 1% for 10 minutes
  - p95 latency > 2s for 10 minutes
  - Memory usage > 80%
  - Queue depth growing for 15 minutes
  - Certificate expiring in < 14 days
```

---

## Observability Stack Recommendations

```
BUDGET-FRIENDLY (self-hosted):
  Logs:    ELK (Elasticsearch + Logstash + Kibana) or Loki + Grafana
  Traces:  Jaeger or Tempo
  Metrics: Prometheus + Grafana
  APM:     Grafana + OpenTelemetry

MANAGED (SaaS):
  Logs:    Datadog, New Relic, Splunk
  Traces:  Datadog, New Relic, Honeycomb
  Metrics: Datadog, New Relic, CloudWatch
  APM:     Datadog, New Relic, Dynatrace

ALL-IN-ONE:
  Datadog, New Relic, Grafana Cloud
```
