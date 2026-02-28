# Backend Testing Strategy

> Testing pyramid, framework-specific patterns, integration testing with real databases.

---

## Testing Pyramid

```
         ┌──────────┐
         │   E2E    │  ~10% — Critical user workflows
         │  Tests   │  Slow, expensive, catch integration issues
         ├──────────┤
         │Integration│  ~20% — API endpoints, DB queries
         │  Tests   │  Medium speed, real dependencies
         ├──────────┤
         │  Unit    │  ~70% — Business logic, pure functions
         │  Tests   │  Fast, isolated, no external deps
         └──────────┘

RULE: If it touches the database → integration test
RULE: If it's pure logic → unit test
RULE: If it's a user workflow → E2E test
```

---

## Unit Testing

### Per-Framework Patterns

**Jest (NestJS / Express / Next.js):**
```typescript
describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(() => {
    repository = { findOne: jest.fn(), create: jest.fn() } as any;
    service = new UsersService(repository);
  });

  it('should throw if user not found', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.getUser('123')).rejects.toThrow(NotFoundException);
  });

  it('should return user when found', async () => {
    const user = { id: '123', email: 'test@test.com' };
    repository.findOne.mockResolvedValue(user);
    expect(await service.getUser('123')).toEqual(user);
  });
});
```

**pytest (FastAPI / Django):**
```python
class TestUserService:
    def test_get_user_not_found(self, user_service, mock_repo):
        mock_repo.find_one.return_value = None
        with pytest.raises(UserNotFoundError):
            user_service.get_user("123")

    def test_get_user_success(self, user_service, mock_repo):
        mock_repo.find_one.return_value = User(id="123", email="test@test.com")
        user = user_service.get_user("123")
        assert user.email == "test@test.com"
```

**JUnit (Spring Boot):**
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock private UserRepository repository;
    @InjectMocks private UserService service;

    @Test
    void shouldThrowWhenUserNotFound() {
        when(repository.findById(any())).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getUser("123"));
    }
}
```

**PHPUnit (Laravel):**
```php
class UserServiceTest extends TestCase {
    public function test_get_user_not_found(): void {
        $this->mock(UserRepository::class)
            ->shouldReceive('find')->andReturn(null);

        $this->expectException(UserNotFoundException::class);
        app(UserService::class)->getUser('123');
    }
}
```

---

## Integration Testing

### API Endpoint Testing

**Supertest (NestJS / Express):**
```typescript
describe('POST /api/users', () => {
  it('should create user with valid input', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .send({ email: 'test@test.com', name: 'Test', password: 'Pass123!' })
      .expect(201)
      .expect(res => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.email).toBe('test@test.com');
      });
  });

  it('should return 400 for invalid email', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .send({ email: 'invalid', name: 'Test', password: 'Pass123!' })
      .expect(400);
  });
});
```

### Database Testing with Real DB

**TestContainers (recommended for all languages):**
```
Start a real PostgreSQL/MySQL/MongoDB in Docker for tests:
  - Each test suite gets a fresh database
  - Run migrations before tests
  - Seed test data per test case
  - Teardown after suite

Benefits:
  ✅ Catches real SQL errors, constraint violations
  ✅ Tests actual migration scripts
  ✅ No mock drift from real database behavior
```

### Contract Testing

**Pact (for microservices):**
```
Consumer defines expected request/response:
  "When I call GET /users/123, I expect { id, name, email }"

Provider verifies it can fulfill the contract:
  Run tests against real provider API

Benefits:
  ✅ Catches breaking API changes before deploy
  ✅ Consumer and provider can develop independently
  ✅ No need for full integration environment
```

---

## Load Testing

### Tool Selection
```
TOOL         LANGUAGE      BEST FOR
──────────────────────────────────────────────────
k6           JavaScript    Developer-friendly, CI-native, modern
Artillery    YAML          Quick setup, good for CI
Locust       Python        Custom scenarios, distributed
JMeter       GUI/XML       Enterprise, legacy systems

RECOMMENDATION: k6 for most teams (open-source, CI-friendly, modern API).
```

### k6 Load Test Script
```javascript
// tests/load/api-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test stages: ramp up → sustain → ramp down
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // ramp to 50 users
    { duration: '3m', target: 50 },    // sustain 50 users
    { duration: '1m', target: 100 },   // ramp to 100 users
    { duration: '3m', target: 100 },   // sustain 100 users
    { duration: '1m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],  // p95 < 200ms
    errors: ['rate<0.01'],                           // error rate < 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  // GET list endpoint
  const listRes = http.get(`${BASE_URL}/api/v1/users?page=1&limit=20`, { headers });
  check(listRes, { 'list status 200': (r) => r.status === 200 });
  errorRate.add(listRes.status !== 200);
  responseTime.add(listRes.timings.duration);

  // GET single resource
  const getRes = http.get(`${BASE_URL}/api/v1/users/1`, { headers });
  check(getRes, { 'get status 200': (r) => r.status === 200 });

  // POST create (use unique data per iteration)
  const payload = JSON.stringify({
    email: `loadtest-${__VU}-${__ITER}@test.com`,
    name: 'Load Test User',
    password: 'TestPass123!',
  });
  const createRes = http.post(`${BASE_URL}/api/v1/users`, payload, { headers });
  check(createRes, { 'create status 201': (r) => r.status === 201 });

  sleep(1); // think time between requests
}
```

### Locust Script (Python)
```python
# tests/load/locustfile.py
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        self.headers = {"Authorization": "Bearer test-token"}
    
    @task(3)  # 3x more likely than other tasks
    def list_users(self):
        self.client.get("/api/v1/users", headers=self.headers)
    
    @task(2)
    def get_user(self):
        self.client.get("/api/v1/users/1", headers=self.headers)
    
    @task(1)
    def create_user(self):
        self.client.post("/api/v1/users", json={
            "email": f"load-{self.environment.runner.user_count}@test.com",
            "name": "Load Test", "password": "Pass123!"
        }, headers=self.headers)
```

### CI Integration (GitHub Actions)
```yaml
  load-test:
    runs-on: ubuntu-latest
    needs: [test]  # run after unit/integration tests pass
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/load/api-load-test.js
        env:
          BASE_URL: http://localhost:3000
          AUTH_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
```

### Performance Budget
```
KEY METRICS:
  p50, p95, p99 response times
  Requests per second (throughput)
  Error rate under load
  Resource utilization (CPU, memory, connections)

TARGETS (typical web API):
  p95 < 200ms for reads
  p95 < 500ms for writes
  Error rate < 0.1% at expected load
  Handle 2x expected peak without degradation

WHEN TO LOAD TEST:
  ✅ Before major release (new feature launch)
  ✅ After infrastructure change (DB migration, new server)
  ✅ When adding new high-traffic endpoints
  ✅ When user base grows significantly
  ⛔ Not needed for small internal tools (<100 users)
```

---

## Test Checklist

```
PER ENDPOINT:
  □ Happy path (valid input → expected output)
  □ Validation error (invalid input → 400)
  □ Not found (missing resource → 404)
  □ Unauthorized (no token → 401)
  □ Forbidden (wrong role → 403)
  □ Edge cases (empty list, max length, special characters)
  □ Concurrent access (race conditions)

PER SERVICE:
  □ Business logic with various inputs
  □ Error handling (what happens when dependency fails)
  □ Edge cases (null, empty, boundary values)

PER MIGRATION:
  □ Up migration runs without error
  □ Down migration runs without error
  □ Data is preserved correctly after migration
```
