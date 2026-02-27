# FastAPI — Production Patterns

> Async/await, Pydantic, SQLAlchemy 2.0, dependency injection, OpenAPI auto-docs.
> Reference: fastapi/fastapi (80k+ stars)

---

## Project Structure

```
app/
├── api/
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── router.py               ← Route aggregation
│   │   ├── users/
│   │   │   ├── __init__.py
│   │   │   ├── router.py           ← User endpoints
│   │   │   ├── schemas.py          ← Pydantic models
│   │   │   ├── service.py          ← Business logic
│   │   │   └── dependencies.py     ← Dependency injection
│   │   └── auth/
│   │       ├── router.py
│   │       ├── schemas.py
│   │       └── service.py
│   └── deps.py                     ← Shared dependencies
├── core/
│   ├── config.py                    ← Settings (Pydantic BaseSettings)
│   ├── security.py                  ← JWT, password hashing
│   └── exceptions.py               ← Custom exceptions
├── db/
│   ├── base.py                      ← SQLAlchemy Base
│   ├── session.py                   ← Async session factory
│   └── migrations/
│       └── alembic/
├── models/
│   ├── __init__.py
│   ├── user.py                      ← SQLAlchemy models
│   └── base.py                      ← Base model with common fields
├── repositories/
│   ├── base.py                      ← Generic CRUD repository
│   └── user.py                      ← User-specific queries
├── main.py                          ← FastAPI app factory
└── tests/
    ├── conftest.py                  ← Fixtures (test DB, client)
    ├── test_users.py
    └── test_auth.py
```

---

## Core Patterns

### App Factory
```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.config import settings

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs" if settings.DEBUG else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    return app

app = create_app()
```

### Pydantic Schemas
```python
# api/v1/users/schemas.py
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8)

class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}

class UserListResponse(BaseModel):
    data: list[UserResponse]
    total: int
    page: int
    limit: int
```

### Router (Endpoints)
```python
# api/v1/users/router.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.api.deps import get_current_user
from .schemas import UserCreate, UserResponse, UserListResponse
from .service import UserService

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    service: UserService = Depends(),
):
    return await service.find_all(page=page, limit=limit)

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, service: UserService = Depends()):
    user = await service.find_one(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
    return user

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, service: UserService = Depends()):
    return await service.create(data)

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    current_user=Depends(get_current_user),
    service: UserService = Depends(),
):
    return await service.update(user_id, data)
```

### Service Layer
```python
# api/v1/users/service.py
from fastapi import Depends
from app.repositories.user import UserRepository
from app.core.security import hash_password
from .schemas import UserCreate, UserUpdate

class UserService:
    def __init__(self, repo: UserRepository = Depends()):
        self.repo = repo

    async def find_all(self, page: int = 1, limit: int = 20):
        users, total = await self.repo.find_many(skip=(page - 1) * limit, limit=limit)
        return {"data": users, "total": total, "page": page, "limit": limit}

    async def find_one(self, user_id):
        return await self.repo.find_by_id(user_id)

    async def create(self, data: UserCreate):
        existing = await self.repo.find_by_email(data.email)
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        hashed = hash_password(data.password)
        return await self.repo.create({**data.model_dump(exclude={"password"}), "password_hash": hashed})
```

### SQLAlchemy 2.0 Model
```python
# models/user.py
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    orders: Mapped[list["Order"]] = relationship(back_populates="user", lazy="selectin")
```

### Async Database Session
```python
# db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

---

## Dependency Injection

```python
# api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import verify_token

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user
```

---

## Alembic Migrations

```bash
# Initialize
alembic init app/db/migrations

# Create migration
alembic revision --autogenerate -m "create users table"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Common Libraries

```
CATEGORY            LIBRARY                 PURPOSE
──────────────────────────────────────────────────────
ORM                 sqlalchemy[asyncio]      Async database
Migration           alembic                  Schema migrations
Validation          pydantic                 Data validation
Auth                python-jose / pyjwt      JWT tokens
Password            passlib[bcrypt]          Password hashing
ASGI Server         uvicorn                  Production server
Task Queue          celery / dramatiq        Background jobs
Cache               redis / aioredis         Caching
Testing             pytest / httpx           Test framework
Linting             ruff                     Fast linter
Type Check          mypy                     Static typing
```
