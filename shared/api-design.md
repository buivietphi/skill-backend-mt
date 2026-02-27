# API Design Patterns

> REST, GraphQL, gRPC, WebSocket — conventions and best practices.

---

## REST API Design

### URL Conventions
```
RESOURCE-BASED URLs (nouns, not verbs):
  ✅ GET    /api/v1/users              → List users
  ✅ GET    /api/v1/users/:id          → Get user by ID
  ✅ POST   /api/v1/users              → Create user
  ✅ PATCH  /api/v1/users/:id          → Partial update
  ✅ PUT    /api/v1/users/:id          → Full replace
  ✅ DELETE /api/v1/users/:id          → Delete user

  ⛔ GET    /api/getUsers              → Don't use verbs
  ⛔ POST   /api/createUser            → Don't use verbs
  ⛔ GET    /api/v1/Users              → Don't capitalize

NESTED RESOURCES:
  GET /api/v1/users/:userId/orders     → Orders for a user
  GET /api/v1/orders/:orderId/items    → Items in an order

  Max nesting: 2 levels. Beyond that, use query params:
  GET /api/v1/items?orderId=123
```

### HTTP Status Codes
```
SUCCESS:
  200 OK              → GET, PATCH, PUT (with body)
  201 Created         → POST (with Location header)
  204 No Content      → DELETE (no body)

CLIENT ERROR:
  400 Bad Request     → Validation failed
  401 Unauthorized    → Missing/invalid auth token
  403 Forbidden       → Authenticated but not authorized
  404 Not Found       → Resource doesn't exist
  409 Conflict        → Duplicate resource / state conflict
  422 Unprocessable   → Semantic validation error
  429 Too Many Reqs   → Rate limit exceeded

SERVER ERROR:
  500 Internal Error  → Unexpected server error (log + alert)
  502 Bad Gateway     → Upstream service failed
  503 Unavailable     → Server overloaded / maintenance
```

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Must be at least 8 characters" }
    ],
    "requestId": "req_abc123"
  }
}
```

### Pagination

**Cursor-Based (Recommended for large datasets):**
```
GET /api/v1/users?limit=20&cursor=eyJpZCI6MTAwfQ

Response:
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTIwfQ",
    "hasMore": true
  }
}
```

**Offset-Based (Simple, for small datasets):**
```
GET /api/v1/users?page=2&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

### Filtering & Sorting
```
GET /api/v1/users?status=active&role=admin      → Filter
GET /api/v1/users?sort=createdAt:desc,name:asc   → Sort
GET /api/v1/users?search=john                     → Search
GET /api/v1/users?fields=id,name,email            → Sparse fields
```

### Versioning
```
URL-based (most common):    /api/v1/users, /api/v2/users
Header-based:               Accept: application/vnd.api.v1+json
Query param:                /api/users?version=1

RECOMMENDATION: URL-based (/api/v1/) for simplicity and cache-friendliness.
```

---

## GraphQL Design

### Schema Design
```graphql
type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

type User {
  id: ID!
  email: String!
  name: String!
  orders: [Order!]!       # Use DataLoader to prevent N+1
  createdAt: DateTime!
}

# Relay-style pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

### N+1 Prevention
```
ALWAYS use DataLoader for nested resolvers:
  Query: users → [user1, user2, user3]
  Each user.orders → N+1 individual queries ❌

  DataLoader batches: getUserOrders([1, 2, 3]) → single query ✅
```

### Security
```
□ Query depth limiting (max 5-7 levels)
□ Query complexity analysis (cost per field)
□ Rate limiting per query
□ Disable introspection in production
□ Input validation on all mutations
```

---

## gRPC Design

### Proto File Conventions
```protobuf
syntax = "proto3";
package user.v1;

service UserService {
  rpc GetUser (GetUserRequest) returns (GetUserResponse);
  rpc ListUsers (ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser (CreateUserRequest) returns (CreateUserResponse);
  rpc UpdateUser (UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser (DeleteUserRequest) returns (DeleteUserResponse);

  // Streaming
  rpc WatchUsers (WatchUsersRequest) returns (stream UserEvent);
}

message GetUserRequest {
  string id = 1;
}

message GetUserResponse {
  User user = 1;
}
```

### When to Use gRPC
```
✅ Service-to-service communication (internal)
✅ High-performance requirements (binary protocol)
✅ Streaming needed (real-time updates)
✅ Strong typing between services

⛔ Browser clients (use REST or GraphQL instead)
⛔ Simple CRUD (overhead not justified)
```

---

## WebSocket Design

### Connection Pattern
```
1. Client connects: ws://api.example.com/ws?token=jwt_token
2. Server validates token on connection
3. Client subscribes to channels/rooms
4. Server pushes events to subscribed clients
5. Heartbeat ping/pong every 30s
6. Auto-reconnect with exponential backoff on client
```

### Message Format
```json
{
  "type": "order.updated",
  "payload": { "orderId": "123", "status": "shipped" },
  "timestamp": "2024-01-15T10:30:00Z",
  "correlationId": "evt_abc123"
}
```

### When to Use WebSocket
```
✅ Real-time notifications (chat, live updates)
✅ Collaborative features (editing, cursors)
✅ Live dashboards (metrics, logs)
✅ Gaming / real-time trading

⛔ Simple request/response (use REST)
⛔ Low-frequency updates (use polling or SSE)
```

---

## HTTP Caching (API-Level)

**Cache at the HTTP layer BEFORE hitting application code.**

### Cache-Control Headers
```
RESPONSE HEADERS:
  Cache-Control: public, max-age=3600       → CDN + browser cache for 1h
  Cache-Control: private, max-age=300       → Browser only, no CDN (user-specific data)
  Cache-Control: no-store                   → Never cache (sensitive data, auth endpoints)
  Cache-Control: no-cache                   → Cache but revalidate every time (ETag check)

PER ENDPOINT TYPE:
  GET /api/v1/products           → public, max-age=300 (5 min)
  GET /api/v1/products/:id       → public, max-age=3600, stale-while-revalidate=60
  GET /api/v1/users/me           → private, max-age=60
  GET /api/v1/config             → public, max-age=86400 (1 day)
  POST/PUT/PATCH/DELETE          → no-store (mutations never cached)
```

### ETag / Conditional Requests
```
FLOW:
  1. Server responds: ETag: "abc123", body: { ... }
  2. Client caches response
  3. Next request: If-None-Match: "abc123"
  4. Server checks: data unchanged? → 304 Not Modified (no body, save bandwidth)
                    data changed?   → 200 OK + new ETag + new body

IMPLEMENTATION:
  ETag = hash(JSON.stringify(responseBody)) or record.updatedAt.getTime()
  ✅ Saves bandwidth on large payloads
  ✅ Always returns fresh data (unlike TTL-only)
```

### CDN Caching
```
CACHE AT EDGE (Cloudflare, CloudFront, Vercel):
  ✅ Static assets (images, fonts, JS/CSS)    → max-age=31536000, immutable
  ✅ Public API responses (product list)       → max-age=60, stale-while-revalidate=300
  ✅ OpenAPI/Swagger docs                      → max-age=3600
  ⛔ User-specific data                        → Cache-Control: private
  ⛔ Auth endpoints                            → Cache-Control: no-store

PURGE STRATEGY:
  - Tag-based: purge all responses tagged "products" when product updates
  - Path-based: purge /api/v1/products/* on mutation
  - Surrogate-Key header: Surrogate-Key: product-123 → purge by key
```

### Caching Decision Matrix
```
ENDPOINT TYPE                   CACHE?    STRATEGY
──────────────────────────────────────────────────────
Public list (products, posts)   YES       CDN + Redis + ETag (5-15 min TTL)
Public detail (/products/:id)   YES       CDN + Redis + ETag (15-60 min TTL)
User-specific (/users/me)       MAYBE     Redis only (private, 1-5 min TTL)
Dashboard / analytics           MAYBE     Redis (30s-5min, depends on freshness needs)
Auth / login / token            NEVER     no-store
Mutations (POST/PUT/DELETE)     NEVER     no-store + invalidate related cache
Real-time data (prices, chat)   NEVER     WebSocket, not HTTP caching
```

---

## Multi-Language API (i18n)

**When API needs to serve content in multiple languages.**

### Request-Level Language Detection
```
PRIORITY ORDER:
  1. Query param:      ?lang=vi
  2. Header:           Accept-Language: vi-VN, en;q=0.9
  3. User preference:  user.preferredLanguage (from DB)
  4. Default:          en (always have a fallback)

MIDDLEWARE PATTERN:
  Extract locale → validate (is it supported?) → attach to request context → use in responses
```

### Response Patterns
```
PATTERN 1: Server-side translation (API returns translated content)
  GET /api/v1/products/123?lang=vi
  → { "name": "Áo thun", "description": "Áo thun cotton..." }
  Best for: CMS content, product descriptions, server-rendered pages

PATTERN 2: Translation keys (API returns keys, client translates)
  GET /api/v1/errors
  → { "error": { "code": "VALIDATION_ERROR", "messageKey": "errors.validation.email" } }
  Best for: Error messages, UI labels, static content

PATTERN 3: Multi-lang fields (all translations in one response)
  GET /api/v1/products/123
  → { "name": { "en": "T-shirt", "vi": "Áo thun" }, ... }
  Best for: Admin panels, CMS editing, few languages

RECOMMENDATION:
  - Pattern 1 for user-facing content APIs
  - Pattern 2 for error messages and validation
  - Pattern 3 for admin/content management
```

### Database Schema for i18n
```sql
-- Option A: JSON column (simple, PostgreSQL/MySQL 8+)
ALTER TABLE products ADD COLUMN name_translations JSONB;
-- { "en": "T-shirt", "vi": "Áo thun", "ja": "Tシャツ" }

-- Option B: Translation table (normalized, any SQL)
CREATE TABLE translations (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,  -- 'product', 'category'
  entity_id UUID NOT NULL,
  field VARCHAR(50) NOT NULL,        -- 'name', 'description'
  locale VARCHAR(10) NOT NULL,       -- 'en', 'vi', 'ja'
  value TEXT NOT NULL,
  UNIQUE(entity_type, entity_id, field, locale)
);

-- Option A: fewer queries, harder to search by locale
-- Option B: more flexible, searchable, but JOIN needed
-- RECOMMENDATION: Option A for < 5 languages, Option B for 5+
```

---

## API Design Checklist

```
□ Consistent URL naming (plural nouns, lowercase, kebab-case)
□ Proper HTTP status codes (not 200 for everything)
□ Consistent error response format with error codes
□ Pagination on all list endpoints
□ Input validation on all write endpoints
□ Auth on all protected endpoints
□ Rate limiting on all public endpoints
□ API versioning strategy
□ Request/Response logging with correlation IDs
□ OpenAPI/Swagger documentation
□ CORS configured for known origins only
□ Cache-Control headers on GET endpoints
□ ETag support for bandwidth-sensitive endpoints
□ Accept-Language handling (if multi-language required)
```
