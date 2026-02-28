# CI/CD & Deployment Patterns

> Docker, Kubernetes, GitHub Actions, deployment strategies.

---

## Dockerfile Best Practices

### Multi-Stage Build (Node.js)
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules prod_modules
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER node
EXPOSE 3000
HEALTHCHECK CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
```

### Multi-Stage Build (Python)
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY . .

USER nobody
EXPOSE 8000
HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Multi-Stage Build (Java)
```dockerfile
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
COPY . .
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar

USER nobody
EXPOSE 8080
HEALTHCHECK CMD curl -f http://localhost:8080/actuator/health || exit 1
CMD ["java", "-jar", "app.jar"]
```

### Docker Best Practices
```
✅ Use specific base image tags (node:20-alpine, NOT node:latest)
✅ Multi-stage builds (smaller final image)
✅ Run as non-root user
✅ Add HEALTHCHECK instruction
✅ Use .dockerignore (exclude node_modules, .git, .env, tests)
✅ Order layers by change frequency (deps first, code last)
⛔ NEVER store secrets in Docker image
⛔ NEVER use root user in production
⛔ NEVER copy .env files into image
```

---

## Docker Compose (Development)

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mydb
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

---

## GitHub Actions CI

### Node.js CI Template
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
      - run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
```

### Python CI Template
```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
      - run: ruff check .
      - run: mypy .
      - run: pytest --cov
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
```

---

## Deployment Strategies

### Blue-Green Deployment
```
  ┌─────────┐         ┌─────────┐
  │  BLUE   │ ←─ LB ──│  GREEN  │
  │ (v1.0)  │         │ (v1.1)  │
  └─────────┘         └─────────┘

1. Deploy new version to GREEN
2. Run smoke tests on GREEN
3. Switch load balancer to GREEN
4. Keep BLUE running (instant rollback)
5. After validation, terminate BLUE

PROS: Zero downtime, instant rollback
CONS: Double infrastructure cost during deploy
```

### Canary Deployment
```
  ┌─────────┐
  │  STABLE │ ←── 95% traffic
  │ (v1.0)  │
  └─────────┘
  ┌─────────┐
  │ CANARY  │ ←── 5% traffic
  │ (v1.1)  │
  └─────────┘

1. Deploy to small subset (5-10%)
2. Monitor errors and latency
3. Gradually increase traffic (25% → 50% → 100%)
4. Rollback if metrics degrade

PROS: Low risk, real-world validation
CONS: More complex routing, slower rollout
```

### Rolling Update
```
  Instance 1: v1.0 → v1.1 (restart)
  Instance 2: v1.0 (serving traffic)
  Instance 3: v1.0 (serving traffic)

  Instance 1: v1.1 (ready)
  Instance 2: v1.0 → v1.1 (restart)
  Instance 3: v1.0 (serving traffic)

  ... until all updated

PROS: No extra infrastructure
CONS: Mixed versions during deploy, slower rollback
```

---

## Kubernetes Basics

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    spec:
      containers:
        - name: api
          image: myregistry/api:1.0.0
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-secret
                  key: url
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 3000

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

---

## Feature Flags

### Simple DB-Based Flags
```sql
CREATE TABLE feature_flags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,       -- 'new-checkout-flow'
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INT DEFAULT 0,         -- 0-100 gradual rollout
  allowed_users JSONB DEFAULT '[]',         -- specific user IDs
  allowed_tenants JSONB DEFAULT '[]',       -- specific tenant IDs
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Feature Flag Service
```typescript
// services/feature-flag.service.ts
@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly flagRepo: FeatureFlagRepository,
    private readonly cache: CacheService,
  ) {}

  async isEnabled(flagName: string, context?: { userId?: string; tenantId?: string }): Promise<boolean> {
    // Cache flags (refresh every 30s)
    const flag = await this.cache.getOrSet(
      `flag:${flagName}`,
      () => this.flagRepo.findByName(flagName),
      30,
    );

    if (!flag) return false;
    if (!flag.isEnabled) return false;

    // Specific user/tenant override
    if (context?.userId && flag.allowedUsers.includes(context.userId)) return true;
    if (context?.tenantId && flag.allowedTenants.includes(context.tenantId)) return true;

    // Percentage rollout (deterministic per user)
    if (flag.rolloutPercentage > 0 && context?.userId) {
      const hash = this.hashUserId(context.userId);
      return (hash % 100) < flag.rolloutPercentage;
    }

    return flag.isEnabled;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (const char of userId) { hash = ((hash << 5) - hash) + char.charCodeAt(0); }
    return Math.abs(hash);
  }
}

// Usage in service:
if (await this.featureFlags.isEnabled('new-checkout', { userId: user.id })) {
  return this.newCheckoutFlow(order);
} else {
  return this.legacyCheckoutFlow(order);
}
```

### Feature Flag Libraries
```
SELF-HOSTED:
  Unleash       → Open-source, self-hosted, SDKs for all languages
  Flagsmith     → Open-source, UI dashboard, A/B testing
  GrowthBook    → Open-source, A/B testing + feature flags

MANAGED (SaaS):
  LaunchDarkly  → Enterprise, real-time updates, targeting rules
  Split.io      → Enterprise, experimentation platform
  Statsig       → Free tier, A/B testing + feature gates

SIMPLE:
  DB-based      → Good enough for <50 flags, no external dependency
  .env flags    → Simplest, requires redeploy to change

DECISION:
  <10 flags, simple on/off     → .env or DB-based
  10-50 flags, gradual rollout → Unleash / GrowthBook (self-hosted)
  50+ flags, enterprise        → LaunchDarkly / Split.io
```

### Feature Flag Best Practices
```
✅ Clean up flags after full rollout (remove old code path)
✅ Use descriptive names: 'new-checkout-v2', not 'flag-1'
✅ Log which flag variant was served (for debugging)
✅ Test BOTH paths (flag on AND flag off)
✅ Default to OFF for new flags (fail-safe)
⛔ Don't nest flags (if flag A AND flag B → too complex)
⛔ Don't use flags for permanent config (use config instead)
⛔ Don't leave stale flags in code (tech debt)
```

