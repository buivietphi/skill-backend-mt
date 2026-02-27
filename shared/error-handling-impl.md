# Error Handling Implementation

> Production patterns for custom exceptions, global handlers, context-rich errors, and error propagation.
> Real code per framework. Not theory — implementation.

---

## Custom Exception Hierarchy

```
AppException (base)
  ├── ValidationException (400)     — input validation failed
  ├── UnauthorizedException (401)   — not authenticated
  ├── ForbiddenException (403)      — not authorized
  ├── NotFoundException (404)       — resource not found
  ├── ConflictException (409)       — duplicate / state conflict
  ├── BusinessRuleException (422)   — business logic violation
  ├── RateLimitException (429)      — too many requests
  └── InternalException (500)       — unexpected error (log + alert)
```

### Node.js / NestJS

```typescript
// src/common/exceptions/app.exception.ts
export class AppException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,           // machine-readable: 'ORDER_NOT_FOUND'
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404,
      `${resource.toUpperCase()}_NOT_FOUND`,
    );
  }
}

export class ConflictException extends AppException {
  constructor(message: string, field?: string) {
    super(message, 409, 'CONFLICT', field ? { field } : undefined);
  }
}

export class BusinessRuleException extends AppException {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, 422, code, details);
  }
}

// Usage in service:
throw new NotFoundException('Order', orderId);
throw new ConflictException('Email already exists', 'email');
throw new BusinessRuleException(
  'Cannot cancel shipped order',
  'ORDER_CANCEL_BLOCKED',
  { currentStatus: order.status },
);
```

### Python / FastAPI

```python
# app/exceptions.py
class AppException(Exception):
    def __init__(self, message: str, status_code: int, code: str, details: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details or {}
        super().__init__(message)

class NotFoundException(AppException):
    def __init__(self, resource: str, id: str | None = None):
        msg = f"{resource} with id '{id}' not found" if id else f"{resource} not found"
        super().__init__(msg, 404, f"{resource.upper()}_NOT_FOUND")

class ConflictException(AppException):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message, 409, "CONFLICT", {"field": field} if field else None)

class BusinessRuleException(AppException):
    def __init__(self, message: str, code: str, details: dict | None = None):
        super().__init__(message, 422, code, details)

# Usage:
raise NotFoundException("Order", order_id)
raise BusinessRuleException("Cannot cancel shipped order", "ORDER_CANCEL_BLOCKED", {"status": order.status})
```

---

## Global Exception Handler

### NestJS

```typescript
// src/common/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const { statusCode, body } = this.buildResponse(exception, request);

    // LOG: error level for 5xx, warn for 4xx
    if (statusCode >= 500) {
      this.logger.error('Unhandled exception', {
        requestId: request.id,
        method: request.method,
        path: request.url,
        userId: request.user?.id,
        statusCode,
        error: exception instanceof Error ? exception.message : 'Unknown',
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.logger.warn('Client error', {
        requestId: request.id,
        method: request.method,
        path: request.url,
        statusCode,
        code: body.code,
      });
    }

    response.status(statusCode).json(body);
  }

  private buildResponse(exception: unknown, request: any) {
    // Custom AppException
    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        body: {
          statusCode: exception.statusCode,
          code: exception.code,
          message: exception.message,
          details: exception.details || {},
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    }

    // NestJS built-in HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as any;
      return {
        statusCode: status,
        body: {
          statusCode: status,
          code: 'HTTP_EXCEPTION',
          message: typeof res === 'string' ? res : res.message,
          details: typeof res === 'object' ? res : {},
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    }

    // Validation pipe errors (class-validator)
    // → Usually caught by NestJS as BadRequestException with message array

    // Unknown error — NEVER expose internals
    return {
      statusCode: 500,
      body: {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };
  }
}

// Register in main.ts:
app.useGlobalFilters(new GlobalExceptionFilter(app.get(LoggerService)));
```

### FastAPI

```python
# app/middleware/exception_handler.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def app_exception_handler(request: Request, exc: AppException):
    status = exc.status_code
    body = {
        "statusCode": status,
        "code": exc.code,
        "message": exc.message,
        "details": exc.details,
        "timestamp": datetime.utcnow().isoformat(),
        "path": str(request.url.path),
    }

    if status >= 500:
        logger.error("Unhandled exception", extra={
            "request_id": request.state.request_id,
            "method": request.method,
            "path": request.url.path,
            "error": exc.message,
        })
    else:
        logger.warning("Client error", extra={"code": exc.code, "path": request.url.path})

    return JSONResponse(status_code=status, content=body)

async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", exc_info=exc, extra={
        "request_id": getattr(request.state, "request_id", "unknown"),
        "path": request.url.path,
    })
    return JSONResponse(status_code=500, content={
        "statusCode": 500,
        "code": "INTERNAL_ERROR",
        "message": "An unexpected error occurred",
        "timestamp": datetime.utcnow().isoformat(),
        "path": str(request.url.path),
    })

# Register in main.py:
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
```

---

## Error Response Format (Consistent)

```json
{
  "statusCode": 422,
  "code": "ORDER_CANCEL_BLOCKED",
  "message": "Cannot cancel a shipped order",
  "details": {
    "currentStatus": "SHIPPED",
    "orderId": "ord_abc123"
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/orders/ord_abc123/cancel"
}
```

```
RULES:
  ✅ statusCode — HTTP status code (redundant but useful for clients)
  ✅ code — machine-readable error code (for client-side handling)
  ✅ message — human-readable message (show to user or developer)
  ✅ details — structured context (field errors, constraints, etc.)
  ✅ timestamp — when error occurred
  ✅ path — which endpoint failed
  ⛔ NEVER include: stack trace, internal error messages, SQL queries, file paths
  ⛔ NEVER expose: which ORM, which DB, internal service names
```

---

## Validation Error Format

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "errors": [
      { "field": "email", "message": "must be a valid email address" },
      { "field": "password", "message": "must be at least 8 characters" },
      { "field": "items[0].quantity", "message": "must be greater than 0" }
    ]
  },
  "timestamp": "2026-02-28T10:30:00.000Z",
  "path": "/api/v1/users"
}
```

---

## Error Propagation Rules

```
WHERE TO CATCH:

  Controller layer:
    ⛔ Don't catch — let global filter handle
    ✅ Exception: transform DTO validation errors (framework-specific)

  Service layer:
    ✅ Catch external API errors → wrap in AppException with context
    ✅ Catch DB unique constraint → throw ConflictException
    ✅ Throw business rule exceptions (BusinessRuleException)
    ⛔ Don't catch generic Error → let it bubble to global handler

  Repository layer:
    ✅ Catch DB connection errors → throw InternalException
    ⛔ Don't catch query errors → let service handle

  External API calls:
    ✅ ALWAYS wrap in try/catch
    ✅ Add timeout
    ✅ Log the external error with context
    ✅ Throw AppException with YOUR error code (not theirs)
```

```typescript
// External API error wrapping
async chargePayment(amount: number, methodId: string): Promise<ChargeResult> {
  try {
    const result = await this.stripeClient.charges.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      source: methodId,
    });
    return { chargeId: result.id, status: result.status };
  } catch (error) {
    // Log the REAL error (for debugging)
    this.logger.error('Stripe charge failed', {
      amount, methodId,
      stripeError: error.message,
      stripeCode: error.code,
    });
    // Throw YOUR exception (don't expose Stripe internals)
    if (error.code === 'card_declined') {
      throw new BusinessRuleException('Payment declined', 'PAYMENT_DECLINED');
    }
    throw new InternalException('Payment processing failed');
  }
}
```

---

## Timeout & Retry Pattern

```typescript
// Timeout wrapper for external calls
async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

// Retry with exponential backoff
async withRetry<T>(fn: () => Promise<T>, opts: { maxRetries: number; baseDelay: number; label: string }): Promise<T> {
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === opts.maxRetries) throw error;
      const delay = opts.baseDelay * Math.pow(2, attempt - 1);
      this.logger.warn(`${opts.label} failed (attempt ${attempt}/${opts.maxRetries}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

// Usage:
const result = await this.withRetry(
  () => this.withTimeout(this.externalApi.call(data), 5000, 'ExternalAPI'),
  { maxRetries: 3, baseDelay: 1000, label: 'ExternalAPI.call' },
);
```
