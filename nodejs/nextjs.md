# Next.js — Backend Patterns

> App Router, API Routes, Server Components, Server Actions, middleware.
> Reference: vercel/next.js (130k+ stars)

---

## Project Structure (App Router)

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx                   ← Shared layout with auth check
│   └── users/
│       ├── page.tsx                 ← Server Component (default)
│       ├── [id]/page.tsx            ← Dynamic route
│       └── actions.ts              ← Server Actions
├── api/
│   ├── v1/
│   │   ├── users/
│   │   │   ├── route.ts            ← GET, POST handlers
│   │   │   └── [id]/route.ts       ← GET, PUT, DELETE by ID
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   └── refresh/route.ts
│   │   └── health/route.ts
│   └── webhooks/
│       └── stripe/route.ts
├── layout.tsx                       ← Root layout
├── page.tsx                         ← Home page
├── error.tsx                        ← Error boundary
├── not-found.tsx                    ← 404 page
└── loading.tsx                      ← Loading UI

src/
├── lib/
│   ├── db.ts                        ← Database client (Prisma)
│   ├── auth.ts                      ← Auth helpers (NextAuth/custom)
│   └── utils.ts                     ← Shared utilities
├── services/
│   ├── users.service.ts             ← Business logic
│   └── auth.service.ts
├── middleware.ts                     ← Root middleware (auth, logging)
└── types/
    └── index.ts
```

---

## API Route Handlers

```typescript
// app/api/v1/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UsersService } from '@/services/users.service';
import { withAuth } from '@/lib/auth';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8),
});

// GET /api/v1/users
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');

  const users = await UsersService.findAll({ page, limit });
  return NextResponse.json(users);
}

// POST /api/v1/users
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = createUserSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: validated.error.flatten() } },
      { status: 400 }
    );
  }

  const user = await UsersService.create(validated.data);
  return NextResponse.json(user, { status: 201 });
}
```

### Dynamic Route Handler
```typescript
// app/api/v1/users/[id]/route.ts
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await UsersService.findOne(id);

  if (!user) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: `User ${id} not found` } },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}
```

---

## Middleware

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export function middleware(request: NextRequest) {
  // Add correlation ID
  const requestId = crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);

  // Auth check for protected routes
  if (request.nextUrl.pathname.startsWith('/api/v1/') &&
      !request.nextUrl.pathname.startsWith('/api/v1/auth/')) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.next({ headers });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/(dashboard)/:path*'],
};
```

---

## Server Actions

```typescript
// app/(dashboard)/users/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { UsersService } from '@/services/users.service';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

export async function updateUser(id: string, formData: FormData) {
  const data = Object.fromEntries(formData);
  const validated = updateSchema.parse(data);

  await UsersService.update(id, validated);
  revalidatePath('/dashboard/users');
}

export async function deleteUser(id: string) {
  await UsersService.remove(id);
  revalidatePath('/dashboard/users');
}
```

---

## Server Components (Data Fetching)

```typescript
// app/(dashboard)/users/page.tsx — Server Component (default)
import { UsersService } from '@/services/users.service';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const users = await UsersService.findAll({ page: parseInt(page ?? '1') });

  return (
    <div>
      {users.data.length === 0 ? (
        <EmptyState message="No users found" />
      ) : (
        <UserList users={users.data} />
      )}
      <Pagination pagination={users.pagination} />
    </div>
  );
}
```

---

## Database (Prisma Integration)

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## Deployment

```
VERCEL (recommended):
  - Zero config, automatic deploys
  - Edge runtime for middleware
  - Serverless API routes
  - ISR (Incremental Static Regeneration)

DOCKER (self-hosted):
  next.config.js: output: 'standalone'
  Dockerfile:
    FROM node:20-alpine AS builder
    COPY . .
    RUN npm ci && npm run build
    FROM node:20-alpine
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    CMD ["node", "server.js"]

NODE (traditional):
  npm run build && npm start
  Behind Nginx reverse proxy
```

---

## Common Libraries

```
CATEGORY            LIBRARY                 PURPOSE
──────────────────────────────────────────────────────
Auth                next-auth               Authentication
Validation          zod                     Schema validation
ORM                 @prisma/client          Database
Data Fetching       swr / @tanstack/query   Client-side fetching
Forms               react-hook-form         Form handling
State               zustand / jotai         Client state
UI                  shadcn/ui               Component library
Email               resend / nodemailer     Transactional email
Upload              uploadthing             File uploads
Rate Limit          upstash/ratelimit       Serverless rate limiting
```
