# Version Management

> Runtime versions, framework compatibility, breaking change handling.

---

## Runtime Version Matrix

```
RUNTIME          LTS VERSIONS        EOL
─────────────────────────────────────────
Node.js 18       LTS (Hydrogen)      April 2025 ⚠️ EOL — MIGRATE
Node.js 20       LTS (Iron)          April 2026
Node.js 22       LTS (Jod)           April 2027 ← RECOMMENDED for new projects
Python 3.10      Active              October 2026
Python 3.11      Active              October 2027
Python 3.12      Active              October 2028 ← RECOMMENDED for new projects
Python 3.13      Active              October 2029
Java 17          LTS                 September 2029
Java 21          LTS                 September 2031 ← RECOMMENDED for new projects
PHP 8.2          Active              December 2026
PHP 8.3          Active              December 2027
PHP 8.4          Active              December 2028 ← RECOMMENDED for new projects
Go 1.22+         Active              ~1 year per release
Ruby 3.3+        Active              ~3 years per release
Rust             Rolling (stable)    6-week release cycle

RULE: Always use LTS versions in production.
RULE: Check EOL before starting new projects.
RULE: WebSearch "[runtime] LTS schedule [current year]" before recommending version.
```

---

## Framework Version Matrix

### Node.js Ecosystem
```
FRAMEWORK          CURRENT    COMPATIBLE RUNTIME
───────────────────────────────────────────────
NestJS 10          10.x       Node 18-22
NestJS 11          11.x       Node 20-22 (released Feb 2025)
Next.js 14         14.x       Node 18-22
Next.js 15         15.x       Node 18-22
Express 4          4.x        Node 14+
Express 5          5.x        Node 18+
Fastify 4          4.x        Node 14+
Fastify 5          5.x        Node 20+
Vue 3              3.x        Node 18+
Nuxt 3             3.x        Node 18+

⚠️ ALWAYS WebSearch "[framework] latest version [current year]" before suggesting version.
   AI training data may be outdated. Verify the ACTUAL current version.
```

### Python Ecosystem
```
FastAPI            0.115+     Python 3.9+
Django 5.1         5.1        Python 3.10+
Django 5.2         5.2        Python 3.10+ (released Apr 2025)
Flask 3.1          3.x        Python 3.9+
SQLAlchemy 2.0     2.x        Python 3.7+
Pydantic 2.0       2.x        Python 3.8+
```

### Java Ecosystem
```
Spring Boot 3.3    3.3        Java 17+ (Jakarta EE 10)
Spring Boot 3.4    3.4        Java 17+ (released Nov 2024)
Spring Framework 6  6.x       Java 17+
```

### PHP Ecosystem
```
Laravel 11         11.x       PHP 8.2+
Laravel 12         12.x       PHP 8.2+
Symfony 7          7.x        PHP 8.2+
```

---

## Dependency Management

### Check Before Installing
```
BEFORE adding any package:
  1. Is it actively maintained? (last commit < 6 months)
  2. Does it have security vulnerabilities? (npm audit, pip audit)
  3. Is it compatible with current runtime version?
  4. Does it overlap with existing dependencies?
  5. What's the bundle size impact?
```

### Lock Files
```
ALWAYS commit lock files:
  Node.js:  package-lock.json / yarn.lock / pnpm-lock.yaml
  Python:   requirements.txt (pinned) / poetry.lock / Pipfile.lock
  Java:     gradle.lockfile (if using)
  PHP:      composer.lock
  Go:       go.sum
  Ruby:     Gemfile.lock
  Rust:     Cargo.lock

WHY: Ensures identical installs across environments.
```

### Version Pinning
```
PRODUCTION:
  ✅ Pin exact versions: "express": "4.18.2"
  ✅ Or use lock file to ensure exact versions

AVOID:
  ⛔ "express": "*"        → Any version (dangerous)
  ⛔ "express": ">=4.0.0"  → Too permissive

ACCEPTABLE FOR DEV DEPS:
  "jest": "^29.0.0"         → Minor updates OK for dev tools
```

---

## Breaking Change Handling

```
WHEN UPGRADING:
  1. Read the CHANGELOG / migration guide
  2. Check for breaking changes
  3. Update in a separate branch
  4. Run full test suite after upgrade
  5. Test in staging before production

COMMON BREAKING CHANGES:
  - API signature changes (function parameters)
  - Default value changes
  - Removed features/methods
  - Changed config format
  - New peer dependency requirements
  - Changed minimum runtime version
```

---

## Security Auditing

```
COMMANDS:
  Node.js:  npm audit / yarn audit / pnpm audit
  Python:   pip-audit / safety check
  Java:     mvn dependency-check:check / gradle dependencyCheckAnalyze
  PHP:      composer audit
  Go:       govulncheck ./...
  Ruby:     bundle-audit check

AUTOMATE:
  - GitHub Dependabot (automatic PRs for vulnerable deps)
  - Snyk (CI integration, license checking)
  - Renovate (automated dependency updates)

RULE: Run audit weekly. Fix CRITICAL immediately. Fix HIGH within 1 week.
```
