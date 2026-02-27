# Laravel — Production Patterns

> Eloquent ORM, Service Container, Form Requests, middleware, queues.
> Reference: laravel/laravel (79k+ stars), PHP 8.4

---

## Project Structure

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Api/V1/
│   │   │   ├── UserController.php
│   │   │   └── AuthController.php
│   │   └── Controller.php           ← Base controller
│   ├── Middleware/
│   │   ├── Authenticate.php
│   │   └── RateLimitApi.php
│   ├── Requests/                    ← Form Request validation
│   │   ├── CreateUserRequest.php
│   │   └── UpdateUserRequest.php
│   └── Resources/                   ← API Resources (response mapping)
│       ├── UserResource.php
│       └── UserCollection.php
├── Models/
│   ├── User.php
│   └── Order.php
├── Services/
│   ├── UserService.php
│   └── AuthService.php
├── Repositories/
│   ├── Contracts/
│   │   └── UserRepositoryInterface.php
│   └── UserRepository.php
├── Exceptions/
│   └── Handler.php                  ← Global exception handler
├── Jobs/                            ← Queue jobs
│   └── SendWelcomeEmail.php
├── Policies/                        ← Authorization policies
│   └── UserPolicy.php
└── Providers/
    ├── AppServiceProvider.php
    └── RepositoryServiceProvider.php

database/
├── migrations/
│   └── 2024_01_01_000001_create_users_table.php
├── seeders/
│   └── UserSeeder.php
└── factories/
    └── UserFactory.php

routes/
├── api.php                          ← API routes
└── web.php

config/
├── app.php
├── auth.php
├── database.php
└── cors.php

tests/
├── Feature/
│   ├── UserTest.php
│   └── AuthTest.php
└── Unit/
    └── UserServiceTest.php
```

---

## Core Patterns

### Model
```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $fillable = ['email', 'name', 'password'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    // Scope for active users
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('deleted_at');
    }
}
```

### Controller
```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Http\Resources\UserCollection;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        private readonly UserService $userService,
    ) {}

    public function index(Request $request): UserCollection
    {
        $users = $this->userService->findAll(
            page: (int) $request->query('page', '1'),
            limit: (int) $request->query('limit', '20'),
        );

        return new UserCollection($users);
    }

    public function show(string $id): UserResource
    {
        $user = $this->userService->findOne($id);
        return new UserResource($user);
    }

    public function store(CreateUserRequest $request): JsonResponse
    {
        $user = $this->userService->create($request->validated());
        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateUserRequest $request, string $id): UserResource
    {
        $user = $this->userService->update($id, $request->validated());
        return new UserResource($user);
    }

    public function destroy(string $id): JsonResponse
    {
        $this->userService->delete($id);
        return response()->json(null, 204);
    }
}
```

### Form Request (Validation)
```php
<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'unique:users,email', 'max:255'],
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }
}
```

### API Resource (Response Mapping)
```php
<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
```

### Service
```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UserService
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
    ) {}

    public function findAll(int $page = 1, int $limit = 20): LengthAwarePaginator
    {
        return $this->userRepository->paginate($limit);
    }

    public function findOne(string $id): User
    {
        return $this->userRepository->find($id)
            ?? throw new NotFoundHttpException("User {$id} not found");
    }

    public function create(array $data): User
    {
        if ($this->userRepository->findByEmail($data['email'])) {
            throw new ConflictHttpException('Email already in use');
        }
        return $this->userRepository->create($data);
    }
}
```

---

## Routes

```php
// routes/api.php
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\AuthController;

Route::prefix('v1')->group(function () {
    // Public routes
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/register', [AuthController::class, 'register']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);
    });
});
```

---

## Query Optimization

```php
// AVOID N+1: Eager loading
$users = User::with('orders')->paginate(20);           // 2 queries
$users = User::with('orders.items')->paginate(20);     // 3 queries

// Atomic updates
Product::where('id', $id)->increment('stock', -1);     // No race condition

// Select specific columns
$emails = User::pluck('email');
$users = User::select(['id', 'email', 'name'])->get();

// Chunked processing (for large datasets)
User::chunk(200, function ($users) {
    foreach ($users as $user) {
        // Process...
    }
});
```

---

## Production Optimization

```bash
# Cache config, routes, views
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Generate optimized autoloader
composer install --optimize-autoloader --no-dev
```

---

## Common Libraries

```
CATEGORY            LIBRARY                     PURPOSE
──────────────────────────────────────────────────────────
Auth                laravel/sanctum             API token auth
Auth                laravel/passport            OAuth2 server
Admin               filament/filament           Admin panel
Queue               Built-in                    Background jobs
Cache               Built-in (Redis driver)     Caching
Testing             Built-in + Pest PHP         Testing
Static Analysis     larastan (PHPStan)          Type checking
Code Style          laravel/pint                Code formatting
Debugging           laravel/telescope           Debug dashboard
API Docs            dedoc/scramble              Auto OpenAPI docs
Search              laravel/scout               Full-text search
```
