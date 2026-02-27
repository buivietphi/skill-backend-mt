# Express & Fastify — Production Patterns

> Middleware pipeline, routing, validation, error handling.
> Reference: expressjs/express (66k+ stars), fastify/fastify (33k+ stars)

---

## Express Project Structure

```
src/
├── routes/
│   ├── index.ts                     ← Route registration
│   ├── users.routes.ts
│   ├── auth.routes.ts
│   └── health.routes.ts
├── controllers/
│   ├── users.controller.ts
│   └── auth.controller.ts
├── services/
│   ├── users.service.ts
│   └── auth.service.ts
├── repositories/
│   ├── users.repository.ts
│   └── base.repository.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── validation.middleware.ts
│   ├── error-handler.middleware.ts
│   ├── rate-limit.middleware.ts
│   └── correlation-id.middleware.ts
├── schemas/                          ← Zod/Joi validation schemas
│   ├── user.schema.ts
│   └── auth.schema.ts
├── models/                           ← DB models/entities
│   └── user.model.ts
├── config/
│   ├── index.ts                     ← Config validation
│   └── database.ts
├── utils/
│   ├── logger.ts                    ← Structured logging (pino/winston)
│   └── errors.ts                    ← Custom error classes
├── types/
│   └── index.ts
├── app.ts                           ← Express app setup
└── server.ts                        ← Server entry point
```

---

## Core Patterns

### App Setup
```typescript
// app.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationId } from './middleware/correlation-id.middleware';
import { errorHandler } from './middleware/error-handler.middleware';
import { routes } from './routes';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request tracking
app.use(correlationId);

// Routes
app.use('/api/v1', routes);

// Error handler (MUST be last)
app.use(errorHandler);

export { app };
```

### Route + Controller Pattern
```typescript
// routes/users.routes.ts
import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { createUserSchema, updateUserSchema } from '../schemas/user.schema';

const router = Router();
const controller = new UsersController();

router.get('/', authMiddleware, controller.findAll);
router.get('/:id', authMiddleware, controller.findOne);
router.post('/', validate(createUserSchema), controller.create);
router.patch('/:id', authMiddleware, validate(updateUserSchema), controller.update);
router.delete('/:id', authMiddleware, controller.remove);

export { router as usersRoutes };
```

### Validation with Zod
```typescript
// schemas/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    password: z.string().min(8),
  }),
});

// middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', details: result.error.flatten() }
      });
    }
    next();
  };
```

### Global Error Handler
```typescript
// middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, requestId: req.headers['x-request-id'] }
    });
  }

  // Unexpected error
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
}
```

---

## Fastify Alternative

```typescript
// Fastify offers better performance and built-in schema validation
import Fastify from 'fastify';

const app = Fastify({ logger: true });

// JSON Schema validation (built-in, no extra library)
app.post('/api/v1/users', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'name', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 2 },
        password: { type: 'string', minLength: 8 },
      },
    },
  },
}, async (request, reply) => {
  const user = await usersService.create(request.body);
  reply.status(201).send(user);
});

// Plugin system (like NestJS modules)
app.register(import('./routes/users'), { prefix: '/api/v1/users' });
app.register(import('./routes/auth'), { prefix: '/api/v1/auth' });
```

---

## Common Libraries

```
CATEGORY            EXPRESS                 FASTIFY
──────────────────────────────────────────────────────
Security            helmet                  @fastify/helmet
CORS                cors                    @fastify/cors
Rate Limit          express-rate-limit      @fastify/rate-limit
Validation          zod / joi               built-in JSON Schema
Auth                passport                @fastify/passport
Session             express-session         @fastify/session
Cookie              cookie-parser           @fastify/cookie
Compression         compression             @fastify/compress
Logging             pino / winston          built-in (pino)
Swagger             swagger-ui-express      @fastify/swagger
```
