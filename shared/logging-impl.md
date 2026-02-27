# Logging Implementation Patterns

> Structured logging setup, correlation IDs, log levels, request/response logging.
> Real code per framework.

---

## Logger Setup

### Node.js (Pino — fastest)

```typescript
// src/common/logger/logger.service.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,  // JSON in production (for log aggregation)
  formatters: {
    level: (label) => ({ level: label }),  // "level": "info" not "level": 30
  },
  redact: {
    paths: ['req.headers.authorization', 'password', 'token', 'secret', 'creditCard'],
    remove: true,  // remove sensitive fields entirely
  },
});

export { logger };
```

### Python (structlog)

```python
# app/logging_config.py
import structlog

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        # Redact sensitive fields
        redact_processor,
        # JSON in production, pretty in dev
        structlog.dev.ConsoleRenderer() if settings.DEBUG else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

def redact_processor(logger, method_name, event_dict):
    for key in ['password', 'token', 'secret', 'authorization']:
        if key in event_dict:
            event_dict[key] = '[REDACTED]'
    return event_dict
```

---

## Correlation ID (Request Tracing)

```
CONCEPT: Every request gets a unique ID. Pass it through all logs, services, queues.
USED FOR: Tracing a request across multiple log entries, services, and background jobs.
```

### Node.js (NestJS Middleware)

```typescript
// src/common/middleware/correlation-id.middleware.ts
import { v4 as uuid } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

export const requestContext = new AsyncLocalStorage<{ requestId: string; userId?: string }>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuid();
    req['requestId'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    // Store in async context (available everywhere without passing explicitly)
    requestContext.run({ requestId, userId: req['user']?.id }, () => {
      next();
    });
  }
}

// Logger automatically includes requestId
const childLogger = logger.child({
  get requestId() { return requestContext.getStore()?.requestId; },
  get userId() { return requestContext.getStore()?.userId; },
});
```

### Python (FastAPI Middleware)

```python
# app/middleware/correlation.py
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="unknown")

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    request_id_var.set(request_id)
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response
```

---

## Log Levels Guide

```
LEVEL     WHEN TO USE                                    EXAMPLE
─────     ──────────                                    ───────
fatal     App cannot continue, shutting down             DB connection permanently lost
error     Operation failed, needs attention              Payment processing failed
warn      Something unexpected but handled               Cache miss on hot key, slow query > 1s
info      Normal operation milestones                    Request completed, user logged in, order created
debug     Detailed info for troubleshooting              Query parameters, intermediate values
trace     Very detailed (rarely used in production)      Function entry/exit, full request body
```

```typescript
// Examples of correct log levels:
logger.info('Order created', { orderId, customerId, amount });
logger.warn('Slow query detected', { query, durationMs: 2500, threshold: 1000 });
logger.error('Payment failed', { orderId, error: err.message, provider: 'stripe' });
logger.debug('Building query', { filters, sort, pagination });

// ⛔ WRONG:
logger.info('Error occurred', { error });  // should be logger.error
logger.error('User logged in');            // should be logger.info
logger.debug('Order created');             // should be logger.info (important event)
```

---

## Request/Response Logging

```typescript
// NestJS Interceptor — log every request
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - start;

          this.logger.info('Request completed', {
            method: req.method,
            path: req.url,
            statusCode: res.statusCode,
            durationMs: duration,
            userId: req.user?.id,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          });

          // Slow request warning
          if (duration > 1000) {
            this.logger.warn('Slow request', {
              method: req.method, path: req.url, durationMs: duration,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - start;
          this.logger.error('Request failed', {
            method: req.method,
            path: req.url,
            durationMs: duration,
            error: error.message,
            statusCode: error.status || 500,
          });
        },
      }),
    );
  }
}
```

---

## Structured Log Output (Production JSON)

```json
{
  "level": "info",
  "time": "2026-02-28T10:30:00.000Z",
  "requestId": "req_abc123",
  "userId": "usr_456",
  "method": "POST",
  "path": "/api/v1/orders",
  "statusCode": 201,
  "durationMs": 145,
  "msg": "Request completed"
}

{
  "level": "error",
  "time": "2026-02-28T10:30:01.000Z",
  "requestId": "req_def789",
  "userId": "usr_789",
  "method": "POST",
  "path": "/api/v1/payments",
  "error": "Card declined",
  "code": "PAYMENT_DECLINED",
  "durationMs": 3200,
  "msg": "Request failed"
}
```

---

## What to Log / What NOT to Log

```
✅ LOG:
  □ Request method, path, status code, duration
  □ User ID (who did it)
  □ Request ID (for tracing)
  □ Error messages + error codes
  □ Business events (order created, payment processed, user registered)
  □ Slow queries (> 1s)
  □ External API calls (to, duration, status)
  □ Queue job processing (jobId, duration, result)

⛔ NEVER LOG:
  □ Passwords, tokens, API keys, secrets
  □ Credit card numbers, SSN, personal health info
  □ Full request/response bodies (too large, may contain PII)
  □ Authorization headers
  □ Database connection strings
  □ Internal file paths or stack traces in production (use error tracking service)

⚠️ LOG WITH CARE:
  □ Email addresses (may be PII — check regulations)
  □ IP addresses (PII in GDPR — may need to anonymize)
  □ User input (sanitize first — may contain XSS/injection)
```

---

## Log Aggregation Tips

```
STRUCTURED JSON → ship to:
  □ ELK Stack (Elasticsearch + Logstash + Kibana)
  □ Datadog, New Relic, Grafana Loki
  □ AWS CloudWatch, GCP Cloud Logging

CORRELATION:
  □ Same requestId across all services → trace full request flow
  □ Pass requestId to background jobs → trace async operations
  □ Include requestId in error responses → user can report it

ALERTING:
  □ error rate > 1% → page on-call
  □ p99 latency > 2s → warn
  □ 5xx count > 10/min → critical alert
  □ Queue depth > 1000 → warn
```
