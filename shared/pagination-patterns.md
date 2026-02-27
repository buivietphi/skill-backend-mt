# Pagination, Filtering & Sorting Implementation

> Production code for offset-based, cursor-based pagination with filtering and sorting.
> SQL + ORM examples. Real queries.

---

## Decision: Offset vs Cursor

```
OFFSET-BASED:                           CURSOR-BASED:
  ✅ Simple to implement                  ✅ Consistent with inserts/deletes
  ✅ Jump to any page                     ✅ Efficient for large datasets
  ✅ Show total count + page numbers      ✅ No skipped/duplicate rows
  ⛔ Slow on large offsets (OFFSET 10000)  ⛔ Can't jump to page N
  ⛔ Inconsistent with concurrent writes   ⛔ No total count (expensive)

  USE WHEN:                              USE WHEN:
  - Admin dashboards                     - Mobile infinite scroll
  - Small datasets (< 100k rows)        - Large datasets (> 100k rows)
  - User expects page numbers            - Real-time feeds
  - Reports with total count             - API for third-party consumers
```

---

## Offset-Based Pagination

### SQL

```sql
-- Basic pagination
SELECT * FROM orders
WHERE customer_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- Total count (separate query)
SELECT COUNT(*) FROM orders
WHERE customer_id = $1 AND status = $2;

-- ⚠️ For large tables, COUNT(*) is slow
-- Alternative: estimate from pg_class
SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'orders';
```

### Node.js (Prisma)

```typescript
// Query DTO
class PaginationQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @IsInt() @Min(0)
  offset: number = 0;

  @IsOptional() @IsIn(['createdAt', 'updatedAt', 'totalAmount', 'status'])
  sortBy: string = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

// Service
async findAll(query: PaginationQueryDto, filters: OrderFiltersDto): Promise<PaginatedResponse<OrderDto>> {
  const where = this.buildWhereClause(filters);

  const [items, total] = await Promise.all([
    this.prisma.order.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      take: query.limit,
      skip: query.offset,
      include: { customer: { select: { id: true, name: true } } },
    }),
    this.prisma.order.count({ where }),
  ]);

  return {
    data: items.map(this.mapToDto),
    meta: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + query.limit < total,
    },
  };
}

// Build where clause from filters
private buildWhereClause(filters: OrderFiltersDto): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.customerId = filters.customerId;

  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = filters.fromDate;
    if (filters.toDate) where.createdAt.lte = filters.toDate;
  }

  if (filters.search) {
    where.OR = [
      { id: { contains: filters.search } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
      { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  if (filters.minAmount || filters.maxAmount) {
    where.totalAmount = {};
    if (filters.minAmount) where.totalAmount.gte = filters.minAmount;
    if (filters.maxAmount) where.totalAmount.lte = filters.maxAmount;
  }

  return where;
}
```

### Python (SQLAlchemy)

```python
async def find_all(self, query: PaginationQuery, filters: OrderFilters) -> PaginatedResponse:
    stmt = select(Order).options(selectinload(Order.customer))

    # Apply filters
    if filters.status:
        stmt = stmt.where(Order.status == filters.status)
    if filters.customer_id:
        stmt = stmt.where(Order.customer_id == filters.customer_id)
    if filters.from_date:
        stmt = stmt.where(Order.created_at >= filters.from_date)
    if filters.search:
        stmt = stmt.where(
            or_(
                Order.id.ilike(f"%{filters.search}%"),
                Order.customer.has(Customer.name.ilike(f"%{filters.search}%")),
            )
        )

    # Count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await self.session.execute(count_stmt)).scalar()

    # Sort + paginate
    sort_col = getattr(Order, query.sort_by, Order.created_at)
    stmt = stmt.order_by(sort_col.desc() if query.sort_order == "desc" else sort_col.asc())
    stmt = stmt.limit(query.limit).offset(query.offset)

    result = await self.session.execute(stmt)
    items = result.scalars().all()

    return PaginatedResponse(
        data=[OrderDTO.from_entity(o) for o in items],
        meta={"total": total, "limit": query.limit, "offset": query.offset},
    )
```

---

## Cursor-Based Pagination

```
CONCEPT: Instead of OFFSET, use the last item's sort value as cursor.

Page 1: SELECT ... ORDER BY created_at DESC LIMIT 20
  → last item: created_at = '2026-02-28T10:00:00'
  → cursor = encode('2026-02-28T10:00:00')

Page 2: SELECT ... WHERE created_at < '2026-02-28T10:00:00' ORDER BY created_at DESC LIMIT 20
  → no OFFSET → fast even for page 1000
```

### Node.js (Prisma)

```typescript
class CursorQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @IsString()
  cursor?: string;  // opaque cursor (base64 encoded)

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'desc';
}

async findAllCursor(query: CursorQueryDto, filters: OrderFiltersDto): Promise<CursorPaginatedResponse<OrderDto>> {
  const where = this.buildWhereClause(filters);

  // Decode cursor
  if (query.cursor) {
    const decoded = this.decodeCursor(query.cursor); // { createdAt, id }
    where.OR = [
      { createdAt: { lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, id: { lt: decoded.id } }, // tiebreaker
    ];
  }

  const items = await this.prisma.order.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // stable sort
    take: query.limit + 1,  // fetch one extra to detect hasMore
  });

  const hasMore = items.length > query.limit;
  if (hasMore) items.pop();

  const lastItem = items[items.length - 1];
  const nextCursor = lastItem
    ? this.encodeCursor({ createdAt: lastItem.createdAt, id: lastItem.id })
    : null;

  return {
    data: items.map(this.mapToDto),
    meta: { hasMore, nextCursor, limit: query.limit },
  };
}

// Cursor encoding (opaque to client)
private encodeCursor(data: Record<string, any>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

private decodeCursor(cursor: string): Record<string, any> {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}
```

---

## Response Formats

```typescript
// Offset-based response
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;      // total items matching filters
    limit: number;      // items per page
    offset: number;     // current offset
    hasMore: boolean;   // more pages available?
  };
}

// Cursor-based response
interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    hasMore: boolean;        // more items available?
    nextCursor: string | null;  // opaque cursor for next page
    limit: number;           // items per page
  };
}
```

---

## Filtering Best Practices

```
WHITELIST allowed filter fields:
  ✅ { status: ['PENDING', 'PROCESSING', 'SHIPPED'] }  // enum values
  ✅ { sortBy: ['createdAt', 'updatedAt', 'totalAmount'] }  // sort fields
  ⛔ NEVER accept arbitrary column names from client → SQL injection risk

FILTER PATTERNS:
  Exact match:    ?status=PENDING              → WHERE status = 'PENDING'
  Range:          ?minAmount=100&maxAmount=500  → WHERE amount BETWEEN 100 AND 500
  Date range:     ?from=2026-01-01&to=2026-02-28 → WHERE created_at BETWEEN ...
  Search:         ?search=john                 → WHERE name ILIKE '%john%'
  Multi-value:    ?status=PENDING,PROCESSING   → WHERE status IN ('PENDING', 'PROCESSING')
  Relation:       ?customerId=usr_123          → WHERE customer_id = 'usr_123'
  Null check:     ?hasShipping=true            → WHERE shipping_address IS NOT NULL

INDEX STRATEGY for filters:
  Most filtered column → single index
  Common filter combo  → composite index (most selective first)
  Search (ILIKE)       → GIN trigram index (pg_trgm)
  Date range           → BTREE index on date column
```

---

## Sorting Security

```
⛔ NEVER:
  orderBy: req.query.sort  // user controls column name → injection risk

✅ ALWAYS:
  const ALLOWED_SORTS = ['createdAt', 'updatedAt', 'totalAmount', 'status'];
  const sortBy = ALLOWED_SORTS.includes(query.sortBy) ? query.sortBy : 'createdAt';

✅ ALWAYS add tiebreaker (stable sort):
  orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }]  // id as tiebreaker
  // Without tiebreaker: items with same sort value may shuffle between pages
```
