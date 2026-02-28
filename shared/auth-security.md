# Authentication & Security Patterns

> JWT, OAuth 2.0, OWASP Top 10, RBAC/ABAC — production security patterns.

---

## Authentication Patterns

### JWT (JSON Web Tokens)

**Flow:**
```
1. Client sends credentials (email + password)
2. Server validates credentials
3. Server generates access token (short-lived: 15-60 min)
4. Server generates refresh token (long-lived: 7-30 days)
5. Client stores access token in memory, refresh token in httpOnly cookie
6. Client sends access token in Authorization header
7. On 401, client uses refresh token to get new access token
```

**Token Structure:**
```
ACCESS TOKEN:
  Header: { "alg": "RS256", "typ": "JWT" }
  Payload: {
    "sub": "user_123",       ← User ID
    "email": "user@email.com",
    "role": "admin",
    "iat": 1700000000,       ← Issued at
    "exp": 1700003600        ← Expires (1 hour)
  }

REFRESH TOKEN:
  - Store in database (not stateless)
  - Single-use: invalidate after each refresh
  - Bind to device/fingerprint
```

**Security Rules:**
```
✅ Use RS256 (asymmetric) for microservices, HS256 (symmetric) for monolith
✅ Keep access token short-lived (15-60 minutes)
✅ Store refresh token in httpOnly, secure, sameSite cookie
✅ Rotate refresh tokens on each use (detect token reuse = breach)
✅ Include minimal claims in token (don't store sensitive data)
⛔ NEVER store JWT in localStorage (XSS vulnerable)
⛔ NEVER put sensitive data in JWT payload (it's base64, not encrypted)
⛔ NEVER use "none" algorithm
```

### OAuth 2.0 / OpenID Connect

**Authorization Code Flow (for web apps):**
```
1. Redirect user to provider: /authorize?response_type=code&client_id=...
2. User authenticates with provider (Google, GitHub, etc.)
3. Provider redirects back with authorization code
4. Server exchanges code for tokens (server-to-server, with client_secret)
5. Server creates session/JWT from user info
```

**PKCE Flow (for SPAs and mobile):**
```
Same as Authorization Code, but:
- Client generates code_verifier (random string)
- Client sends code_challenge = SHA256(code_verifier)
- On token exchange, client sends code_verifier for verification
- No client_secret needed (safe for public clients)
```

### Session-Based Auth

```
WHEN TO USE:
  ✅ Server-side rendered apps (Next.js SSR, Django, Rails, Laravel)
  ✅ Single-server deployments
  ✅ Need instant session revocation

WHEN TO AVOID:
  ⛔ Microservices (session sharing is complex)
  ⛔ Mobile apps (cookies don't work well)
  ⛔ Stateless API services

SESSION STORAGE:
  Development → In-memory
  Production → Redis (shared across instances)

SESSION SECURITY:
  ✅ httpOnly cookie (no JavaScript access)
  ✅ Secure flag (HTTPS only)
  ✅ SameSite=Lax or Strict
  ✅ Regenerate session ID after login
  ✅ Set reasonable expiration (1-24 hours)
```

### API Key Management (for Machine-to-Machine)

```
STORAGE:
  - Hash the secret key in database (like passwords)
  - Show the plain text secret key ONLY ONCE at creation time
  - Store a hint (last 4 chars) to help users identify the key

KEY SCOPING:
  ✅ Attach permissions to the key (not just the user)
  ✅ e.g., "readonly", "write-stripe", "webhook-triggers"

KEY ROTATION:
  1. Generate new key
  2. Keep old key active
  3. Change client to use new key
  4. Revoke old key (after 7-30 days grace period)

IMPLEMENTATION PATTERN:
  Format: prefix_environment_randomstring_checksum
  Example: sk_live_51Mabc..._xDf9 (Stripe pattern)
  Why prefix? Prevents committing live keys to GitHub (easy regex scanning)
```

---

## Authorization Patterns

### RBAC (Role-Based Access Control)

```
ROLES:          PERMISSIONS:
  admin     →   users:read, users:write, users:delete, orders:*, settings:*
  manager   →   users:read, orders:read, orders:write
  user      →   orders:read (own only), profile:read, profile:write

IMPLEMENTATION:
  1. Store role on user record
  2. Define permission map (role → permissions)
  3. Check permissions in middleware/guard:

     @Roles('admin', 'manager')
     @Get('users')
     findAll() { ... }
```

### ABAC (Attribute-Based Access Control)

```
MORE GRANULAR THAN RBAC:
  Rule: user.department === resource.department AND user.role >= 'manager'

USE WHEN:
  ✅ Complex access rules based on resource attributes
  ✅ Multi-tenant applications
  ✅ Dynamic permission requirements
```

### Resource-Level Authorization

```
ALWAYS check resource ownership:

  // BAD: Only checks if authenticated
  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);  // Any user can see any order!
  }

  // GOOD: Checks ownership
  @Get('orders/:id')
  getOrder(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.ordersService.findOne(id);
    if (order.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException();
    }
    return order;
  }
```

---

## OWASP Top 10 Prevention

### 1. Broken Access Control (A01)
```
✅ Deny by default (explicitly grant access)
✅ Check authorization at service layer (not just route)
✅ Validate resource ownership
✅ Disable directory listing
✅ Log access control failures
```

### 2. Cryptographic Failures (A02)
```
✅ HTTPS everywhere (TLS 1.2+)
✅ bcrypt/argon2 for passwords (cost factor 12+)
✅ Encrypt sensitive data at rest (AES-256)
✅ Never store payment card data
✅ Rotate encryption keys periodically
```

### 3. Injection (A03)
```
✅ Parameterized queries (ALWAYS)
✅ ORM methods (avoid raw SQL)
✅ Input validation (whitelist, not blacklist)
✅ Escape output for the context (HTML, SQL, shell)
✅ Use WAF for additional protection
```

### 4. Insecure Design (A04)
```
✅ Threat modeling before implementation
✅ Rate limiting on all endpoints
✅ Brute-force protection on auth endpoints
✅ Resource consumption limits (file size, query depth)
```

### 5. Security Misconfiguration (A05)
```
✅ Remove default credentials
✅ Disable debug mode in production
✅ Security headers: HSTS, X-Frame-Options, CSP, X-Content-Type-Options
✅ Disable unnecessary HTTP methods
✅ Remove server version headers
```

### 6-10: Vulnerable Components, Auth Failures, Data Integrity, Logging, SSRF
```
✅ Keep dependencies updated (npm audit, pip audit)
✅ Multi-factor authentication for admin
✅ Verify data integrity (signatures, checksums)
✅ Log all auth events with correlation IDs
✅ Validate/whitelist server-side request URLs
```

---

## Rate Limiting

```
STRATEGY:
  Public endpoints:   100 requests/minute per IP
  Auth endpoints:     10 requests/minute per IP (brute-force protection)
  API with key:       1000 requests/minute per key
  Admin endpoints:    50 requests/minute per user

IMPLEMENTATION:
  - Use sliding window algorithm
  - Store counters in Redis (shared across instances)
  - Return 429 with Retry-After header
  - Include rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining

LIBRARIES:
  Express:    express-rate-limit + rate-limit-redis
  NestJS:     @nestjs/throttler
  FastAPI:    slowapi
  Django:     django-ratelimit
  Spring:     bucket4j / resilience4j
  Laravel:    built-in throttle middleware
```

---

## CORS Configuration

```
PRODUCTION (explicit origins):
  Access-Control-Allow-Origin: https://app.example.com
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE
  Access-Control-Allow-Headers: Content-Type, Authorization
  Access-Control-Allow-Credentials: true

DEVELOPMENT:
  Access-Control-Allow-Origin: http://localhost:3000

⛔ NEVER: Access-Control-Allow-Origin: * (with credentials)
```

---

## Content Security Policy (CSP)

```
WHAT IT DOES:
  Mitigates XSS by whitelisting trusted sources for scripts, styles, images.
  Essential for any backend serving HTML (SSR, Django, Rails).

EXAMPLE HEADER:
  Content-Security-Policy: 
    default-src 'self';
    script-src 'self' https://trusted.cdn.com 'nonce-random123';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https://images.example.com;
    connect-src 'self' https://api.example.com;
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    upgrade-insecure-requests;

IMPLEMENTATION:
  Node.js:   Helmet middleware (helmet.contentSecurityPolicy)
  Python:    django-csp or FastAPI custom middleware
  Rails:     config.content_security_policy

PRO-TIP: Use Content-Security-Policy-Report-Only first to find violations without breaking the site.
```

---

## Secret Management

```
HIERARCHY (most to least secure):
  1. Secret Manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager)
  2. Environment variables (set in deployment config, not in code)
  3. .env files (NEVER committed to git, in .gitignore)

RULES:
  ✅ Rotate secrets periodically (at least quarterly)
  ✅ Use different secrets per environment (dev ≠ staging ≠ prod)
  ✅ Audit secret access logs
  ✅ Encrypt secrets at rest
  ⛔ NEVER commit secrets to git (even in private repos)
  ⛔ NEVER log secrets
  ⛔ NEVER pass secrets as URL parameters
```
