# Testing Fixtures & Implementation

> Factories, builders, mocking patterns, test data setup.
> Real code. Not theory — write tests that work.

---

## Test Factory Pattern

```
PURPOSE: Generate test data with sensible defaults.
  factory.build()     → in-memory object (no DB)
  factory.create()    → persisted to DB
  factory.buildMany() → multiple in-memory
  factory.createMany()→ multiple persisted
```

### Node.js (Jest + Prisma)

```typescript
// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export class UserFactory {
  private overrides: Partial<User> = {};

  static new() { return new UserFactory(); }

  withEmail(email: string) { this.overrides.email = email; return this; }
  withRole(role: string) { this.overrides.role = role; return this; }
  asAdmin() { this.overrides.role = 'ADMIN'; return this; }
  asInactive() { this.overrides.isActive = false; return this; }

  build(): Partial<User> {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'USER',
      isActive: true,
      createdAt: new Date(),
      ...this.overrides,
    };
  }

  async create(prisma: PrismaClient): Promise<User> {
    return prisma.user.create({ data: this.build() as any });
  }

  buildMany(count: number): Partial<User>[] {
    return Array.from({ length: count }, () => UserFactory.new().build());
  }

  async createMany(prisma: PrismaClient, count: number): Promise<User[]> {
    return Promise.all(
      Array.from({ length: count }, () => UserFactory.new().create(prisma)),
    );
  }
}

// test/factories/order.factory.ts
export class OrderFactory {
  private overrides: Partial<Order> = {};
  private itemCount = 1;

  static new() { return new OrderFactory(); }

  forCustomer(customerId: string) { this.overrides.customerId = customerId; return this; }
  withStatus(status: string) { this.overrides.status = status; return this; }
  withItems(count: number) { this.itemCount = count; return this; }

  build(): Partial<Order> {
    return {
      id: faker.string.uuid(),
      customerId: faker.string.uuid(),
      status: 'PENDING',
      totalAmount: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
      createdAt: new Date(),
      ...this.overrides,
    };
  }

  async create(prisma: PrismaClient): Promise<Order> {
    return prisma.order.create({
      data: {
        ...this.build() as any,
        items: {
          create: Array.from({ length: this.itemCount }, () => ({
            productId: faker.string.uuid(),
            quantity: faker.number.int({ min: 1, max: 5 }),
            price: parseFloat(faker.commerce.price()),
          })),
        },
      },
      include: { items: true },
    });
  }
}

// Usage in tests:
const user = await UserFactory.new().asAdmin().create(prisma);
const order = await OrderFactory.new().forCustomer(user.id).withStatus('SHIPPED').create(prisma);
```

### Python (pytest + SQLAlchemy)

```python
# tests/factories.py
import factory
from faker import Faker

fake = Faker()

class UserFactory:
    @staticmethod
    def build(**overrides) -> dict:
        return {
            "id": fake.uuid4(),
            "email": fake.email(),
            "name": fake.name(),
            "role": "USER",
            "is_active": True,
            **overrides,
        }

    @staticmethod
    async def create(session, **overrides) -> User:
        data = UserFactory.build(**overrides)
        user = User(**data)
        session.add(user)
        await session.flush()
        return user

# Usage:
user = await UserFactory.create(session, role="ADMIN")
order = await OrderFactory.create(session, customer_id=user.id, status="SHIPPED")
```

---

## Test Database Setup

### Node.js (Prisma + PostgreSQL)

```typescript
// test/setup.ts — shared test database
let prisma: PrismaClient;

beforeAll(async () => {
  // Use test database (from .env.test)
  prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_TEST } } });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Clean between tests (fast: truncate, not drop+migrate)
afterEach(async () => {
  const tablenames = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }
});

export { prisma };
```

### Python (pytest fixtures)

```python
# tests/conftest.py
@pytest.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(settings.TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def session(db_engine):
    async with AsyncSession(db_engine) as session:
        async with session.begin():
            yield session
            await session.rollback()  # auto-rollback each test
```

---

## Mocking External Services

```typescript
// Mock payment service
const mockPaymentService = {
  charge: jest.fn().mockResolvedValue({ chargeId: 'ch_123', status: 'succeeded' }),
  refund: jest.fn().mockResolvedValue({ refundId: 'rf_123' }),
};

// Mock email service
const mockEmailService = {
  send: jest.fn().mockResolvedValue(undefined),
};

// Inject mocks
const module = await Test.createTestingModule({
  providers: [
    OrderService,
    { provide: PaymentService, useValue: mockPaymentService },
    { provide: EmailService, useValue: mockEmailService },
    { provide: PrismaService, useValue: prisma },
  ],
}).compile();

const orderService = module.get(OrderService);

// In test:
it('should charge payment and send email', async () => {
  const result = await orderService.placeOrder(dto, user);

  expect(mockPaymentService.charge).toHaveBeenCalledWith(100, 'pm_123');
  expect(mockEmailService.send).toHaveBeenCalledWith(
    expect.objectContaining({ to: user.email, subject: expect.stringContaining('Order') }),
  );
  expect(result.status).toBe('PROCESSING');
});

// Test failure scenario:
it('should rollback when payment fails', async () => {
  mockPaymentService.charge.mockRejectedValueOnce(new Error('Card declined'));

  await expect(orderService.placeOrder(dto, user)).rejects.toThrow('Payment declined');

  // Verify no order was created
  const orders = await prisma.order.findMany({ where: { customerId: user.id } });
  expect(orders).toHaveLength(0);
});
```

---

## Unit Test Structure

```typescript
describe('OrderService', () => {
  describe('create', () => {
    it('should create order with valid data', async () => { /* happy path */ });
    it('should throw NotFoundException when customer not found', async () => { /* edge case */ });
    it('should throw BadRequestException when customer inactive', async () => { /* business rule */ });
    it('should throw ForbiddenException for unauthorized user', async () => { /* auth */ });
    it('should throw BadRequestException when insufficient stock', async () => { /* validation */ });
    it('should decrement stock in transaction', async () => { /* side effect */ });
    it('should emit order.created event', async () => { /* event */ });
    it('should handle concurrent stock reservation', async () => { /* concurrency */ });
  });

  describe('update', () => {
    it('should update allowed fields', async () => { /* happy path */ });
    it('should reject invalid state transition', async () => { /* state machine */ });
    it('should only update provided fields (partial)', async () => { /* PATCH behavior */ });
    it('should invalidate cache after update', async () => { /* side effect */ });
  });

  describe('delete', () => {
    it('should soft delete order', async () => { /* happy path */ });
    it('should prevent deleting shipped orders', async () => { /* business rule */ });
    it('should be idempotent for already deleted', async () => { /* idempotency */ });
  });
});
```

---

## Integration Test Pattern

```typescript
// test/integration/orders.integration.spec.ts
describe('Orders API (integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();

    // Create test users and get tokens
    const admin = await UserFactory.new().asAdmin().create(prisma);
    const user = await UserFactory.new().create(prisma);
    adminToken = generateToken(admin);
    userToken = generateToken(user);
  });

  it('POST /orders — should create order', async () => {
    const product = await ProductFactory.new().create(prisma);
    const dto = { items: [{ productId: product.id, quantity: 2 }] };

    const res = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send(dto)
      .expect(201);

    expect(res.body.data).toMatchObject({
      status: 'PENDING',
      items: expect.arrayContaining([
        expect.objectContaining({ productId: product.id, quantity: 2 }),
      ]),
    });

    // Verify DB state
    const dbOrder = await prisma.order.findUnique({ where: { id: res.body.data.id } });
    expect(dbOrder).not.toBeNull();
    expect(dbOrder.status).toBe('PENDING');
  });

  it('GET /orders — non-admin sees only own orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    res.body.data.forEach(order => {
      expect(order.customerId).toBe(user.id);
    });
  });

  it('DELETE /orders/:id — non-admin cannot delete', async () => {
    const order = await OrderFactory.new().create(prisma);

    await request(app.getHttpServer())
      .delete(`/orders/${order.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});
```

---

## Test Anti-Patterns

```
⛔ Test depends on other tests (order matters)
  ✅ Each test creates its own data, cleans up after

⛔ Testing implementation details (checking private methods)
  ✅ Test behavior: input → output + side effects

⛔ Mocking everything (no real DB)
  ✅ Unit tests mock externals, integration tests use real DB

⛔ No assertion on error scenarios
  ✅ Test BOTH success AND failure paths

⛔ Hardcoded IDs/dates in test data
  ✅ Use factories with random data

⛔ Shared mutable state between tests
  ✅ Reset mocks: beforeEach(() => jest.clearAllMocks())

⛔ Flaky tests that depend on timing
  ✅ Use deterministic data, avoid setTimeout in tests
```
