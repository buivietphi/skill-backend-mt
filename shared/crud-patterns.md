# CRUD Service Implementation Patterns

> Step-by-step patterns for writing production-grade Create/Read/Update/Delete services.
> Real code, real edge cases, cross-framework.

---

## Service Method Structure

**Every service method follows this flow:**

```
VALIDATE → AUTHORIZE → EXECUTE → SIDE EFFECTS → RETURN DTO

  1. VALIDATE input (DTO validation + business rules)
  2. AUTHORIZE (does this user have permission?)
  3. EXECUTE core logic (DB operations)
  4. SIDE EFFECTS (events, notifications, cache invalidation)
  5. RETURN mapped DTO (never return raw entity)
```

---

## CREATE Pattern

```typescript
// NestJS / Express / Node.js
async create(dto: CreateOrderDto, currentUser: User): Promise<OrderResponseDto> {
  // 1. VALIDATE business rules (beyond DTO validation)
  const customer = await this.customerRepo.findById(dto.customerId);
  if (!customer) throw new NotFoundException('Customer not found');
  if (!customer.isActive) throw new BadRequestException('Customer account is inactive');

  // 2. AUTHORIZE
  if (customer.id !== currentUser.id && !currentUser.isAdmin) {
    throw new ForbiddenException('Cannot create order for another user');
  }

  // 3. EXECUTE in transaction (multi-step = transaction)
  const order = await this.prisma.$transaction(async (tx) => {
    // Check inventory
    for (const item of dto.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }
    }

    // Create order
    const order = await tx.order.create({
      data: {
        customerId: dto.customerId,
        status: 'PENDING',
        totalAmount: this.calculateTotal(dto.items),
        items: { create: dto.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price })) },
      },
      include: { items: true },
    });

    // Decrement stock
    for (const item of dto.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return order;
  });

  // 4. SIDE EFFECTS (outside transaction — non-critical)
  this.eventEmitter.emit('order.created', { orderId: order.id, customerId: order.customerId });

  // 5. RETURN DTO (never return raw entity)
  return this.mapToDto(order);
}
```

```python
# FastAPI / Django
async def create_order(self, dto: CreateOrderDTO, current_user: User) -> OrderResponseDTO:
    # 1. VALIDATE
    customer = await self.customer_repo.get_by_id(dto.customer_id)
    if not customer:
        raise NotFoundException("Customer not found")
    if not customer.is_active:
        raise BadRequestException("Customer account is inactive")

    # 2. AUTHORIZE
    if customer.id != current_user.id and not current_user.is_admin:
        raise ForbiddenException("Cannot create order for another user")

    # 3. EXECUTE in transaction
    async with self.db.transaction():
        for item in dto.items:
            product = await self.product_repo.get_by_id(item.product_id)
            if not product or product.stock < item.quantity:
                raise BadRequestException(f"Insufficient stock for {product.name}")

        order = await self.order_repo.create(
            customer_id=dto.customer_id,
            status="PENDING",
            total_amount=self._calculate_total(dto.items),
            items=dto.items,
        )

        for item in dto.items:
            await self.product_repo.decrement_stock(item.product_id, item.quantity)

    # 4. SIDE EFFECTS
    await self.event_bus.publish("order.created", {"order_id": order.id})

    # 5. RETURN DTO
    return OrderResponseDTO.from_entity(order)
```

### CREATE Edge Cases Checklist

```
□ Duplicate check (unique constraint — email, slug, code)
  → Check BEFORE insert OR catch unique violation → friendly error
□ Foreign key exists (customer, category, parent)
  → Validate ALL references exist before creating
□ Default values (status, createdAt, createdBy)
  → Set in service or DB default — NEVER trust client
□ Computed fields (totalAmount, slug from name)
  → Calculate in service — NEVER trust client-provided computed values
□ Concurrent creation (two users create same unique resource)
  → Use unique constraint + catch error → "already exists"
□ Empty arrays (order with 0 items)
  → Validate: items.length > 0
□ Nested creation (order + items in one request)
  → Use transaction — ALL or NOTHING
```

---

## READ Pattern

```typescript
// Single entity
async findById(id: string, currentUser: User): Promise<OrderResponseDto> {
  const order = await this.prisma.order.findUnique({
    where: { id },
    include: { items: true, customer: true },  // eager load what's needed
  });

  if (!order) throw new NotFoundException('Order not found');

  // AUTHORIZE: can this user see this order?
  if (order.customerId !== currentUser.id && !currentUser.isAdmin) {
    throw new ForbiddenException();  // Don't reveal that order exists
  }

  return this.mapToDto(order);
}

// List with filters (see pagination-patterns.md for full pagination)
async findAll(query: OrderQueryDto, currentUser: User): Promise<PaginatedResponse<OrderResponseDto>> {
  const where: Prisma.OrderWhereInput = {
    // Non-admin can only see own orders
    ...(currentUser.isAdmin ? {} : { customerId: currentUser.id }),
    // Optional filters
    ...(query.status && { status: query.status }),
    ...(query.fromDate && { createdAt: { gte: query.fromDate } }),
    ...(query.search && {
      OR: [
        { id: { contains: query.search } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    this.prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
      skip: query.offset,
      take: query.limit,
    }),
    this.prisma.order.count({ where }),
  ]);

  return {
    data: items.map(this.mapToDto),
    meta: { total, offset: query.offset, limit: query.limit },
  };
}
```

### READ Edge Cases Checklist

```
□ Not found → 404 (not empty 200)
□ Unauthorized access → 403 (not 404 — or 404 to hide existence)
□ Soft-deleted records → filter out by default (where: { deletedAt: null })
□ N+1 queries → include/join what you need in ONE query
□ Large result set → ALWAYS paginate (never return all)
□ Sensitive fields → strip from DTO (password, tokens, internal IDs)
□ Empty list → return { data: [], meta: { total: 0 } } (not 404)
□ Sort injection → whitelist allowed sort fields
□ Filter injection → whitelist allowed filter fields
```

---

## UPDATE Pattern

```typescript
async update(id: string, dto: UpdateOrderDto, currentUser: User): Promise<OrderResponseDto> {
  // 1. FIND existing (verify it exists + get current state)
  const existing = await this.prisma.order.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException('Order not found');

  // 2. AUTHORIZE
  if (existing.customerId !== currentUser.id && !currentUser.isAdmin) {
    throw new ForbiddenException();
  }

  // 3. VALIDATE state transitions
  if (existing.status === 'SHIPPED' && dto.status === 'CANCELLED') {
    throw new BadRequestException('Cannot cancel a shipped order');
  }

  // 4. EXECUTE (partial update — only provided fields)
  const updated = await this.prisma.order.update({
    where: { id },
    data: {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.shippingAddress !== undefined && { shippingAddress: dto.shippingAddress }),
      updatedAt: new Date(),
      updatedBy: currentUser.id,
    },
    include: { items: true },
  });

  // 5. SIDE EFFECTS
  if (dto.status && dto.status !== existing.status) {
    this.eventEmitter.emit('order.statusChanged', {
      orderId: id, from: existing.status, to: dto.status,
    });
  }

  // 6. INVALIDATE cache
  await this.cache.del(`order:${id}`);

  return this.mapToDto(updated);
}
```

### UPDATE Edge Cases Checklist

```
□ Partial update (PATCH) — only update provided fields, not null-out missing ones
  → Use: if (dto.field !== undefined) { data.field = dto.field }
□ Full replace (PUT) — replace entire resource
  → Use: all fields required in DTO
□ State machine transitions — validate before/after status
  → Map: { PENDING: ['PROCESSING', 'CANCELLED'], PROCESSING: ['SHIPPED'], ... }
□ Optimistic locking — prevent lost updates
  → Add version field OR use updatedAt check (see concurrency-patterns.md)
□ Immutable fields — some fields cannot change after creation
  → Validate: if (dto.customerId && dto.customerId !== existing.customerId) throw
□ Cascade updates — updating parent affects children?
  → Use transaction for related updates
□ Audit trail — who changed what when
  → Store: updatedBy, updatedAt, optional: change log table
□ Cache invalidation — stale data after update
  → Delete cache key immediately after successful update
```

---

## DELETE Pattern

```typescript
// Soft delete (recommended for most cases)
async softDelete(id: string, currentUser: User): Promise<void> {
  const existing = await this.prisma.order.findUnique({ where: { id } });
  if (!existing) throw new NotFoundException('Order not found');

  // AUTHORIZE
  if (!currentUser.isAdmin) throw new ForbiddenException('Only admins can delete orders');

  // VALIDATE — can this be deleted?
  if (existing.status === 'SHIPPED') {
    throw new BadRequestException('Cannot delete shipped orders');
  }

  // SOFT DELETE
  await this.prisma.order.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: currentUser.id },
  });

  // SIDE EFFECTS
  await this.cache.del(`order:${id}`);
  this.eventEmitter.emit('order.deleted', { orderId: id });
}

// Hard delete (only for cleanup / GDPR)
async hardDelete(id: string, currentUser: User): Promise<void> {
  if (!currentUser.isSuperAdmin) throw new ForbiddenException();

  await this.prisma.$transaction(async (tx) => {
    // Delete children first (or use cascade)
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id } });
  });
}
```

### DELETE Edge Cases Checklist

```
□ Soft vs hard delete — almost always soft delete
  → Soft: set deletedAt timestamp, filter in all queries
  → Hard: only for GDPR/compliance, with super-admin permission
□ Cascade delete — what happens to children?
  → DB cascade OR manual delete in transaction
□ Reference check — is this used by other entities?
  → Check foreign keys before deleting → "Cannot delete: used by X"
□ Idempotent — delete already-deleted resource
  → Return 204 (not 404) for idempotency
□ Undo/restore — can soft-deleted records be restored?
  → Provide restore endpoint if needed
□ Cleanup side effects — files, cache, external systems
  → Queue cleanup job for async cleanup
```

---

## DTO Mapping Pattern

```typescript
// Entity → DTO (never expose raw entity)
private mapToDto(order: OrderWithItems): OrderResponseDto {
  return {
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      // ⛔ NEVER include: password, internalId, deletedAt
    },
    items: order.items.map(item => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    // ⛔ NEVER include: deletedAt, deletedBy, internalNotes
  };
}
```

```python
# Python — Pydantic
class OrderResponseDTO(BaseModel):
    id: str
    status: str
    total_amount: Decimal
    customer: CustomerSummaryDTO
    items: list[OrderItemDTO]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_entity(cls, order: Order) -> "OrderResponseDTO":
        return cls(
            id=str(order.id),
            status=order.status,
            total_amount=order.total_amount,
            customer=CustomerSummaryDTO.from_entity(order.customer),
            items=[OrderItemDTO.from_entity(i) for i in order.items],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
```

---

## State Machine Pattern

```
ORDER STATUS TRANSITIONS:
  PENDING     → [PROCESSING, CANCELLED]
  PROCESSING  → [SHIPPED, CANCELLED]
  SHIPPED     → [DELIVERED, RETURNED]
  DELIVERED   → [RETURNED]
  CANCELLED   → []  (terminal)
  RETURNED    → []  (terminal)
```

```typescript
// Reusable state machine validator
const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

function validateTransition(from: string, to: string): void {
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new BadRequestException(`Cannot transition from ${from} to ${to}`);
  }
}
```

---

## Multi-Step Business Logic Pattern

```
COMPLEX OPERATION = ORCHESTRATOR SERVICE

OrderService.placeOrder(dto):
  1. inventoryService.checkAvailability(items)     → throws if unavailable
  2. inventoryService.reserve(items)                → reserve with TTL
  3. paymentService.charge(amount, paymentMethod)   → throws if declined
  4. orderRepo.create(order)                        → persist
  5. inventoryService.confirm(reservationId)         → finalize reservation
  6. notificationService.sendConfirmation(order)     → async (don't block)

ROLLBACK on failure:
  Step 3 fails → inventoryService.release(reservationId)
  Step 4 fails → paymentService.refund(chargeId) + inventoryService.release(reservationId)
  Step 5 fails → log warning (order exists, inventory will auto-release by TTL)
  Step 6 fails → log warning (order OK, retry notification later)
```

```typescript
async placeOrder(dto: PlaceOrderDto, user: User): Promise<OrderResponseDto> {
  let reservationId: string | null = null;
  let chargeId: string | null = null;

  try {
    // Reserve inventory
    reservationId = await this.inventoryService.reserve(dto.items);

    // Charge payment
    chargeId = await this.paymentService.charge(dto.totalAmount, dto.paymentMethodId);

    // Create order
    const order = await this.orderRepo.create({
      ...dto, status: 'PROCESSING', chargeId,
    });

    // Confirm reservation
    await this.inventoryService.confirm(reservationId);

    // Non-critical: send notification (don't block)
    this.notificationService.sendConfirmation(order).catch(err => {
      this.logger.warn('Failed to send confirmation', { orderId: order.id, error: err.message });
    });

    return this.mapToDto(order);
  } catch (error) {
    // ROLLBACK
    if (chargeId) await this.paymentService.refund(chargeId).catch(e => this.logger.error('Refund failed', e));
    if (reservationId) await this.inventoryService.release(reservationId).catch(e => this.logger.error('Release failed', e));
    throw error;
  }
}
```
