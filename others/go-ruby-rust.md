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

### Rust Error Handling (Production)
```rust
// errors/mod.rs — Custom error types with thiserror
use thiserror::Error;
use axum::response::{IntoResponse, Response};
use axum::http::StatusCode;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Resource not found: {0}")]
    NotFound(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Conflict: {0}")]
    Conflict(String),
    #[error("Internal error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "Unauthorized".into()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "CONFLICT", msg.clone()),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal error".into()),
        };
        (status, Json(json!({ "code": code, "message": message }))).into_response()
    }
}
```

---

## Ruby on Rails — Extended Patterns

### Active Record Scopes & Concerns
```ruby
# models/user.rb
class User < ApplicationRecord
  # Scopes for common queries
  scope :active, -> { where(is_active: true) }
  scope :by_role, ->(role) { where(role: role) }
  scope :recent, -> { order(created_at: :desc) }
  scope :search, ->(q) { where("name ILIKE ? OR email ILIKE ?", "%#{q}%", "%#{q}%") }

  # Validations
  validates :email, presence: true, uniqueness: { scope: :tenant_id }
  validates :name, presence: true, length: { minimum: 2, maximum: 100 }
  validates :password, length: { minimum: 8 }, if: :password_required?

  # Associations
  has_many :orders, dependent: :restrict_with_error
  belongs_to :tenant

  # Callbacks (use sparingly)
  before_save :normalize_email
  after_create :send_welcome_email, if: :confirmed?

  private

  def normalize_email
    self.email = email.downcase.strip
  end
end

# Concern for soft delete (shared across models)
# app/models/concerns/soft_deletable.rb
module SoftDeletable
  extend ActiveSupport::Concern
  included do
    scope :active, -> { where(deleted_at: nil) }
    scope :deleted, -> { where.not(deleted_at: nil) }
  end

  def soft_delete!
    update!(deleted_at: Time.current)
  end

  def restore!
    update!(deleted_at: nil)
  end
end
```

### Rails API Error Handling
```ruby
# app/controllers/concerns/error_handler.rb
module ErrorHandler
  extend ActiveSupport::Concern

  included do
    rescue_from ActiveRecord::RecordNotFound, with: :not_found
    rescue_from ActiveRecord::RecordInvalid, with: :unprocessable
    rescue_from ActionController::ParameterMissing, with: :bad_request
    rescue_from Pundit::NotAuthorizedError, with: :forbidden
  end

  private

  def not_found(e)
    render json: { code: "NOT_FOUND", message: e.message }, status: :not_found
  end

  def unprocessable(e)
    render json: { code: "VALIDATION_ERROR", message: e.message,
                   details: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def forbidden(_e)
    render json: { code: "FORBIDDEN", message: "Not authorized" }, status: :forbidden
  end

  def bad_request(e)
    render json: { code: "BAD_REQUEST", message: e.message }, status: :bad_request
  end
end
```

### Rails Testing (RSpec + FactoryBot)
```ruby
# spec/services/users/create_service_spec.rb
RSpec.describe Users::CreateService do
  let(:tenant) { create(:tenant) }
  let(:valid_params) { attributes_for(:user).merge(tenant_id: tenant.id) }

  describe ".call" do
    context "with valid params" do
      it "creates a user" do
        result = described_class.call(valid_params)
        expect(result).to be_success
        expect(result.user).to be_persisted
        expect(result.user.email).to eq(valid_params[:email])
      end
    end

    context "with duplicate email" do
      before { create(:user, email: valid_params[:email], tenant: tenant) }

      it "returns failure" do
        result = described_class.call(valid_params)
        expect(result).not_to be_success
        expect(result.errors).to include(/already been taken/)
      end
    end
  end
end

# spec/requests/api/v1/users_spec.rb
RSpec.describe "Users API", type: :request do
  let(:token) { generate_jwt(user) }
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/v1/users" do
    it "returns paginated users" do
      create_list(:user, 25, tenant: user.tenant)
      get "/api/v1/users", headers: headers, params: { page: 1 }
      expect(response).to have_http_status(:ok)
      expect(json_body["data"].count).to eq(20) # default page size
    end
  end
end
```

---

## Go — Extended Patterns

### Go Middleware Chain
```go
// middleware/chain.go
func Chain(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewares[i](handler)
    }
    return handler
}

// middleware/auth.go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" {
            http.Error(w, `{"code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
            return
        }
        claims, err := validateJWT(strings.TrimPrefix(token, "Bearer "))
        if err != nil {
            http.Error(w, `{"code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
            return
        }
        ctx := context.WithValue(r.Context(), "user", claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Usage:
mux := http.NewServeMux()
handler := Chain(mux, LoggingMiddleware, AuthMiddleware, CORSMiddleware)
```

### Go Table-Driven Tests
```go
func TestUserService_FindByID(t *testing.T) {
    tests := []struct {
        name    string
        id      string
        want    *model.User
        wantErr error
    }{
        {name: "found", id: "123", want: &model.User{ID: "123", Email: "test@test.com"}, wantErr: nil},
        {name: "not found", id: "999", want: nil, wantErr: ErrNotFound},
        {name: "empty id", id: "", want: nil, wantErr: ErrInvalidID},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            svc := NewUserService(mockRepo)
            got, err := svc.FindByID(context.Background(), tt.id)
            assert.Equal(t, tt.wantErr, err)
            assert.Equal(t, tt.want, got)
        })
    }
}
```

