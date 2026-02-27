# CLAUDE.md Template for Backend Projects

> Drop this into your project root as CLAUDE.md to give Claude context about your backend project.

---

## Template

```markdown
# CLAUDE.md

## Project Overview
- **Name**: [project name]
- **Description**: [what this project does]
- **Framework**: [NestJS / Next.js / Express / Django / FastAPI / Spring Boot / Laravel]
- **Language**: [TypeScript / Python / Java / PHP / Go]
- **Database**: [PostgreSQL / MySQL / MongoDB / SQLite]
- **ORM**: [Prisma / TypeORM / SQLAlchemy / Eloquent / Spring Data]

## Architecture
- [Describe your architecture: Clean / Hexagonal / Layer-based / Module-based]
- [Describe folder structure: where controllers, services, repos live]

## Development Commands
```bash
# Install dependencies
[npm install / pip install -r requirements.txt / ./gradlew build / composer install]

# Run development server
[npm run start:dev / uvicorn app.main:app --reload / ./gradlew bootRun / php artisan serve]

# Run tests
[npm run test / pytest / ./gradlew test / php artisan test]

# Run linter
[npm run lint / ruff check . / ./gradlew check / php-cs-fixer fix --dry-run]

# Run database migration
[npx prisma migrate dev / alembic upgrade head / ./gradlew flywayMigrate / php artisan migrate]
```

## Important Conventions
- [Naming conventions: camelCase / snake_case / PascalCase]
- [Import style: absolute @/ or relative ../]
- [Error handling pattern: exceptions / Result type / error codes]
- [Auth pattern: JWT / session / OAuth]

## Environment Variables
- `DATABASE_URL` — Database connection string
- `JWT_SECRET` — JWT signing secret
- `REDIS_URL` — Redis connection string
- [Add your project-specific env vars]

## Do NOT
- Do not change the existing architecture
- Do not add new dependencies without asking
- Do not modify migration files that have been applied
- Do not commit .env files
```
