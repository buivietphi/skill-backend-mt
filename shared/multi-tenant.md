# Multi-Tenant Architecture Patterns

> Tenant isolation, data separation, middleware, and scaling strategies for SaaS backends.

---

## Tenant Isolation Strategies

### Decision Matrix

```
STRATEGY                    ISOLATION    COST        COMPLEXITY   USE WHEN
────────────────────────────────────────────────────────────────────────────
Row-Level (shared DB)       Low          Low         Low          Most SaaS apps, startups, <100 tenants
Schema-Per-Tenant           Medium       Medium      Medium       Compliance needs, moderate isolation
Database-Per-Tenant         High         High        High         Enterprise, strict data isolation, regulated
Hybrid (shared + dedicated) Varies       Medium      High         Mix of free + enterprise tiers
```

### Decision Flow
```
START → "Strict regulatory compliance (HIPAA, SOC2)?"
  YES → "Budget for dedicated infrastructure?"
    YES → Database-Per-Tenant
    NO  → Schema-Per-Tenant
  NO  → "More than 1000 tenants?"
    YES → Row-Level (only scalable option)
    NO  → "Enterprise customers need isolation?"
      YES → Hybrid (shared default + dedicated for enterprise)
      NO  → Row-Level (simplest, cheapest)
```

---

## Row-Level Tenant Isolation (Recommended Default)

### Database Schema
```sql
-- Every table has a tenant_id column
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,      -- subdomain or identifier
  plan VARCHAR(50) NOT NULL DEFAULT 'free', -- free, pro, enterprise
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)  -- email unique PER tenant
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: Index on tenant_id for every table
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
```

### PostgreSQL Row-Level Security (RLS)
```sql
-- Enable RLS on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their tenant's data
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Set tenant context per request (in middleware)
-- SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
```

### Tenant Middleware

**NestJS:**
```typescript
// middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract tenant from: subdomain, header, JWT claim, or path
    const tenantId = this.extractTenantId(req);
    if (!tenantId) throw new UnauthorizedException('Tenant not identified');

    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenException('Tenant not found or inactive');
    }

    req['tenant'] = tenant;
    next();
  }

  private extractTenantId(req: Request): string | null {
    // Priority: JWT claim > header > subdomain
    if (req.user?.tenantId) return req.user.tenantId;
    if (req.headers['x-tenant-id']) return req.headers['x-tenant-id'] as string;
    
    // Subdomain extraction: tenant1.api.example.com
    const host = req.headers.host;
    const subdomain = host?.split('.')[0];
    if (subdomain && subdomain !== 'api' && subdomain !== 'www') {
      return subdomain; // resolve to tenant ID
    }
    return null;
  }
}
```

**FastAPI:**
```python
# middleware/tenant.py
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession

async def get_current_tenant(request: Request, db: AsyncSession = Depends(get_db)):
    tenant_id = (
        getattr(request.state, 'user', {}).get('tenant_id')
        or request.headers.get('x-tenant-id')
        or extract_subdomain(request)
    )
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Tenant not identified")
    
    tenant = await db.get(Tenant, tenant_id)
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant not found or inactive")
    
    # Set RLS context
    await db.execute(text(f"SET LOCAL app.current_tenant_id = '{tenant.id}'"))
    return tenant
```

### Repository Pattern with Tenant Scoping

```typescript
// Base repository — ALL queries scoped to tenant
@Injectable()
export class TenantScopedRepository<T> {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(tenantId: string, where?: any) {
    return this.prisma[this.model].findMany({
      where: { tenantId, ...where },
    });
  }

  async findById(tenantId: string, id: string) {
    return this.prisma[this.model].findUnique({
      where: { id, tenantId },  // ALWAYS include tenantId
    });
  }

  async create(tenantId: string, data: any) {
    return this.prisma[this.model].create({
      data: { ...data, tenantId },  // ALWAYS inject tenantId
    });
  }
}
```

---

## Schema-Per-Tenant

```sql
-- Each tenant gets their own schema
CREATE SCHEMA tenant_acme;
CREATE SCHEMA tenant_globex;

-- Tables exist in each schema
CREATE TABLE tenant_acme.users (...);
CREATE TABLE tenant_globex.users (...);

-- Switch schema per request
SET search_path TO tenant_acme, public;
```

```
PROS:
  ✅ Better isolation than row-level
  ✅ Easy to export/delete tenant data (DROP SCHEMA)
  ✅ Can customize per tenant (different indexes)

CONS:
  ⛔ Migration complexity (run per schema)
  ⛔ Connection pooling harder (schema switching)
  ⛔ Doesn't scale beyond ~500 tenants
```

---

## Database-Per-Tenant

```
ARCHITECTURE:
  Tenant Registry (central DB) → stores tenant metadata + DB connection strings
  Per-tenant DB → each tenant has their own database

  Request → Identify tenant → Look up connection string → Connect to tenant DB

PROS:
  ✅ Maximum isolation (compliance-ready)
  ✅ Easy to backup/restore per tenant
  ✅ Can scale independently per tenant
  ✅ Can place tenant DB in specific region (data residency)

CONS:
  ⛔ Expensive (one DB per tenant)
  ⛔ Migration must run on ALL databases
  ⛔ Cross-tenant queries impossible
  ⛔ Connection management complex
```

---

## Cache Key Isolation

```
ALWAYS prefix cache keys with tenant ID:

  ✅ cache.set(`tenant:${tenantId}:users:${userId}`, data)
  ✅ cache.set(`tenant:${tenantId}:config`, settings)
  
  ⛔ cache.set(`users:${userId}`, data)  ← CROSS-TENANT LEAK!

CACHE INVALIDATION:
  Per-tenant: cache.del(`tenant:${tenantId}:*`)
  Per-resource: cache.del(`tenant:${tenantId}:users:${userId}`)
```

---

## Tenant-Aware Background Jobs

```typescript
// ALWAYS include tenantId in job data
await queue.add('send-invoice', {
  tenantId: tenant.id,  // ← CRITICAL
  orderId: order.id,
});

// Worker MUST set tenant context before processing
processor.process(async (job) => {
  const { tenantId, orderId } = job.data;
  const tenant = await tenantService.findById(tenantId);
  // Set DB context, cache prefix, etc.
  await processWithTenantContext(tenant, orderId);
});
```

---

## Multi-Tenant Checklist

```
PER REQUEST:
  □ Tenant identified (subdomain / header / JWT / path)
  □ Tenant validated (exists + active)
  □ Tenant context set on request object
  □ All DB queries scoped to tenant
  □ All cache keys prefixed with tenant ID

PER FEATURE:
  □ New tables have tenant_id column + index
  □ Unique constraints are per-tenant (UNIQUE(tenant_id, email))
  □ Background jobs include tenant_id
  □ File uploads scoped to tenant (S3 prefix: tenants/{tenantId}/...)
  □ Rate limiting per tenant (not just per IP)
  □ Audit logs include tenant context

SECURITY:
  □ No cross-tenant data leakage in queries
  □ No cross-tenant cache access
  □ No cross-tenant file access
  □ Admin endpoints verify tenant ownership
  □ RLS enabled on PostgreSQL (if using row-level)
```
