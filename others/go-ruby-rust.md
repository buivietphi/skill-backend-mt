# Go, Ruby on Rails, Rust — Backend Patterns

> Essential patterns for Go (Gin/Echo), Ruby on Rails, Rust (Actix/Axum).

---

## Go

### Project Structure
```
cmd/
├── api/
│   └── main.go                      ← Entry point
internal/
├── handler/                          ← HTTP handlers (like controllers)
│   ├── user_handler.go
│   └── auth_handler.go
├── service/                          ← Business logic
│   └── user_service.go
├── repository/                       ← Data access
│   └── user_repository.go
├── model/                            ← Domain models
│   └── user.go
├── middleware/                        ← HTTP middleware
│   ├── auth.go
│   └── logger.go
├── config/
│   └── config.go                    ← Env config (viper/envconfig)
└── dto/
    └── user_dto.go                  ← Request/Response types
pkg/
├── database/
│   └── postgres.go                  ← DB connection pool
└── validator/
    └── validator.go
```

### Key Patterns
```go
// Handler (Gin)
func (h *UserHandler) GetUser(c *gin.Context) {
    id := c.Param("id")
    user, err := h.service.FindByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
        return
    }
    c.JSON(http.StatusOK, user)
}

// Service
func (s *UserService) FindByID(ctx context.Context, id string) (*model.User, error) {
    return s.repo.FindByID(ctx, id)
}

// Repository (sqlx)
func (r *UserRepo) FindByID(ctx context.Context, id string) (*model.User, error) {
    var user model.User
    err := r.db.GetContext(ctx, &user, "SELECT * FROM users WHERE id = $1", id)
    if err == sql.ErrNoRows {
        return nil, ErrNotFound
    }
    return &user, err
}
```

### Common Libraries
```
Router:     gin-gonic/gin, labstack/echo
ORM:        gorm.io/gorm, sqlx (raw SQL), ent
Migration:  golang-migrate/migrate, atlas
Config:     viper, kelseyhightower/envconfig
Auth:       golang-jwt/jwt
Validation: go-playground/validator
Logging:    uber-go/zap, rs/zerolog
Testing:    testify, gomock
gRPC:       google.golang.org/grpc
```

### Go Best Practices
```
✅ Error handling: return errors, don't panic
✅ Use context.Context for cancellation and timeouts
✅ Use goroutines + channels for concurrency
✅ Use interfaces for dependency injection
✅ Use table-driven tests
⛔ Don't use global state (pass dependencies explicitly)
⛔ Don't ignore returned errors
⛔ Don't use init() for complex setup
```

---

## Ruby on Rails

### Project Structure
```
app/
├── controllers/
│   ├── api/v1/
│   │   ├── users_controller.rb
│   │   └── auth_controller.rb
│   └── application_controller.rb
├── models/
│   ├── user.rb
│   └── application_record.rb
├── services/                        ← Service objects (POROs)
│   ├── users/
│   │   ├── create_service.rb
│   │   └── update_service.rb
│   └── base_service.rb
├── serializers/                     ← Response formatting
│   └── user_serializer.rb
├── policies/                        ← Pundit authorization
│   └── user_policy.rb
└── jobs/
    └── send_welcome_email_job.rb

config/
├── routes.rb
├── database.yml
└── environments/
    ├── development.rb
    └── production.rb

db/
├── migrate/
│   └── 20240101000001_create_users.rb
└── schema.rb
```

### Key Patterns
```ruby
# Controller
class Api::V1::UsersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_user, only: [:show, :update, :destroy]

  def index
    users = User.active.page(params[:page]).per(20)
    render json: UserSerializer.new(users).serializable_hash
  end

  def show
    render json: UserSerializer.new(@user).serializable_hash
  end

  def create
    result = Users::CreateService.call(user_params)
    if result.success?
      render json: UserSerializer.new(result.user).serializable_hash, status: :created
    else
      render json: { error: result.errors }, status: :unprocessable_entity
    end
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:email, :name, :password)
  end
end

# Service object
class Users::CreateService
  def self.call(params)
    new(params).call
  end

  def initialize(params)
    @params = params
  end

  def call
    user = User.new(@params)
    user.save ? OpenStruct.new(success?: true, user: user) :
                OpenStruct.new(success?: false, errors: user.errors.full_messages)
  end
end
```

### Common Libraries (Gems)
```
Auth:         devise, jwt
Serializer:   jsonapi-serializer, blueprinter
Authorization: pundit
Background:   sidekiq, good_job
Pagination:   kaminari, pagy
Search:       ransack, pg_search
Admin:        administrate, activeadmin
Testing:      rspec, factory_bot, faker
API Docs:     rswag (Swagger)
Linting:      rubocop
```

---

## Rust (Actix-web / Axum)

### Project Structure
```
src/
├── main.rs
├── config.rs
├── routes/
│   ├── mod.rs
│   ├── users.rs
│   └── auth.rs
├── handlers/
│   ├── mod.rs
│   └── user_handler.rs
├── services/
│   └── user_service.rs
├── models/
│   └── user.rs
├── db/
│   └── pool.rs
├── middleware/
│   └── auth.rs
├── errors/
│   └── mod.rs                       ← Custom error types
└── dto/
    └── user_dto.rs
```

### Key Patterns (Axum)
```rust
// Handler
async fn get_user(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(UserResponse::from(user)))
}

// Router
fn user_routes() -> Router<AppState> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/:id", get(get_user).patch(update_user).delete(delete_user))
        .layer(middleware::from_fn(auth_middleware))
}
```

### Common Crates
```
Web:        actix-web, axum, rocket
ORM:        diesel, sea-orm
SQL:        sqlx (async, compile-time checked)
Async:      tokio (runtime)
Serializer: serde, serde_json
Auth:       jsonwebtoken
Config:     config, dotenvy
Logging:    tracing, tracing-subscriber
Validation: validator
Testing:    Built-in + tokio::test
Error:      thiserror, anyhow
```

### Rust Best Practices
```
✅ Use Result<T, E> for all error-prone operations
✅ Use typed errors (thiserror) for library code, anyhow for app code
✅ Use sqlx compile-time query checking
✅ Use tower middleware for cross-cutting concerns
✅ Use async/await with tokio runtime
⛔ Don't use unwrap() in production code
⛔ Don't clone unnecessarily (borrow when possible)
⛔ Don't use unsafe unless absolutely necessary
```
