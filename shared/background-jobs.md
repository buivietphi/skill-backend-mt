# Background Jobs & Queue Patterns

> Job handlers, retries, error handling, monitoring.
> Real code for BullMQ (Node.js), Celery (Python), Spring Async.

---

## When to Use Background Jobs

```
USE QUEUE:                              DON'T USE QUEUE:
  □ Email/SMS notifications               □ Simple DB write
  □ Image/video processing                □ Input validation
  □ PDF generation                        □ Auth check
  □ External API calls (slow/unreliable)  □ Fast cache lookup
  □ Data export (CSV, reports)            □ Read-only queries < 100ms
  □ Scheduled tasks (daily cleanup)
  □ Webhook delivery
  □ Payment processing callbacks
  □ Search index updates
```

---

## Job Handler Structure

### Node.js (BullMQ)

```typescript
// src/jobs/processors/order-confirmation.processor.ts
@Processor('notifications')
export class OrderConfirmationProcessor {
  constructor(
    private readonly emailService: EmailService,
    private readonly orderRepo: OrderRepository,
    private readonly logger: LoggerService,
  ) {}

  @Process('send-order-confirmation')
  async handle(job: Job<{ orderId: string; userId: string }>) {
    const { orderId, userId } = job.data;

    this.logger.info('Processing order confirmation', { jobId: job.id, orderId });

    // 1. FETCH data (don't pass large objects in job data — just IDs)
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      this.logger.warn('Order not found, skipping', { orderId });
      return; // Don't retry — data doesn't exist
    }

    // 2. CHECK if already processed (idempotency)
    if (order.confirmationSentAt) {
      this.logger.info('Confirmation already sent, skipping', { orderId });
      return;
    }

    // 3. EXECUTE
    await this.emailService.send({
      to: order.customer.email,
      template: 'order-confirmation',
      data: { orderNumber: order.number, items: order.items, total: order.totalAmount },
    });

    // 4. MARK as processed
    await this.orderRepo.update(orderId, { confirmationSentAt: new Date() });

    this.logger.info('Order confirmation sent', { jobId: job.id, orderId });
  }
}

// Dispatching a job
async placeOrder(dto: PlaceOrderDto): Promise<Order> {
  const order = await this.orderRepo.create(dto);

  // Queue job (don't await — fire and forget)
  await this.notificationQueue.add('send-order-confirmation', {
    orderId: order.id,
    userId: order.customerId,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s
    removeOnComplete: 100,  // keep last 100 completed jobs
    removeOnFail: 500,      // keep last 500 failed jobs
  });

  return order;
}
```

### Python (Celery)

```python
# tasks/notifications.py
@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 60s between retries
    acks_late=True,          # acknowledge AFTER completion (not before)
)
def send_order_confirmation(self, order_id: str):
    try:
        order = OrderRepository.find_by_id(order_id)
        if not order:
            logger.warning("Order not found, skipping", extra={"order_id": order_id})
            return

        if order.confirmation_sent_at:
            logger.info("Already sent, skipping", extra={"order_id": order_id})
            return

        EmailService.send(
            to=order.customer.email,
            template="order-confirmation",
            data={"order_number": order.number, "total": order.total_amount},
        )

        OrderRepository.update(order_id, confirmation_sent_at=datetime.utcnow())
        logger.info("Confirmation sent", extra={"order_id": order_id})

    except EmailServiceUnavailable as exc:
        # Retry on transient errors
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    except Exception as exc:
        logger.error("Failed to send confirmation", exc_info=exc, extra={"order_id": order_id})
        raise

# Dispatch:
send_order_confirmation.delay(order_id=order.id)
```

---

## Retry Strategy

```
RETRY RULES:
  ✅ Retry on: network timeout, service unavailable (503), rate limit (429)
  ⛔ Don't retry on: validation error (400), not found (404), auth error (401)

BACKOFF:
  Exponential: 5s → 10s → 20s → 40s (delay * 2^attempt)
  With jitter:  random(5s-10s) → random(10s-20s) → random(20s-40s)

MAX RETRIES:
  Email/notification: 3 retries (if still fails → dead letter queue)
  Payment callback:   5 retries (money is critical)
  Data sync:          10 retries (eventual consistency)
  Report generation:  1 retry (user can re-trigger)
```

```typescript
// BullMQ retry config
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,  // base delay: 5s
  },
}

// Custom retry logic (retry on specific errors only)
@Process('process-payment')
async handlePayment(job: Job) {
  try {
    await this.paymentService.process(job.data);
  } catch (error) {
    if (error.code === 'RATE_LIMITED' || error.code === 'SERVICE_UNAVAILABLE') {
      throw error; // BullMQ will retry
    }
    if (error.code === 'CARD_DECLINED') {
      // Don't retry — permanent failure
      await this.notifyUser(job.data.userId, 'Payment failed');
      return; // Complete without error
    }
    throw error; // Unknown error — retry
  }
}
```

---

## Dead Letter Queue (DLQ)

```typescript
// Jobs that fail all retries go to DLQ
const failedQueue = new Queue('failed-jobs');

notificationQueue.on('failed', async (job, error) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to DLQ for manual review
    await failedQueue.add('dead-letter', {
      originalQueue: 'notifications',
      jobName: job.name,
      jobData: job.data,
      error: error.message,
      failedAt: new Date().toISOString(),
      attempts: job.attemptsMade,
    });

    // Alert ops team
    await this.alertService.notify('Job permanently failed', {
      queue: 'notifications', jobId: job.id, error: error.message,
    });
  }
});
```

---

## Scheduled Jobs (CRON)

```typescript
// NestJS (using @nestjs/schedule)
@Injectable()
export class ScheduledTasks {
  @Cron('0 3 * * *')  // 3 AM daily
  async cleanupExpiredSessions() {
    const deleted = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.info(`Cleaned ${deleted.count} expired sessions`);
  }

  @Cron('*/5 * * * *')  // Every 5 minutes
  async processScheduledEmails() {
    const pending = await this.prisma.scheduledEmail.findMany({
      where: { scheduledAt: { lte: new Date() }, sentAt: null },
      take: 100,
    });
    for (const email of pending) {
      await this.emailQueue.add('send-scheduled', { emailId: email.id });
    }
  }

  @Cron('0 0 1 * *')  // 1st of each month
  async generateMonthlyReports() {
    await this.reportQueue.add('monthly-report', {
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
    });
  }
}
```

---

## Job Design Rules

```
✅ Job data: pass IDs only (not full objects) — data may change between dispatch and execution
✅ Idempotent: job can run twice safely (check "already processed" flag)
✅ Small: one job = one task (don't batch 1000 emails in one job)
✅ Timeout: set per-job timeout (don't let jobs run forever)
✅ Logging: log jobId + business ID (orderId) for tracing
✅ Monitoring: track queue depth, processing time, failure rate

⛔ Don't pass secrets in job data (fetch from config at execution time)
⛔ Don't depend on in-memory state (job may run on different instance)
⛔ Don't ignore failed jobs (alert on DLQ, review periodically)
⛔ Don't use queue for synchronous operations (if caller needs result immediately, don't queue it)
```
