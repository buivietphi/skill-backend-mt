# Webhook Implementation Patterns

> Receiving and sending webhooks: signature verification, retry, deduplication, idempotency.
> Real code for Stripe, payment providers, and custom webhooks.

---

## Receiving Webhooks

### Signature Verification (CRITICAL)

```typescript
// NestJS — Stripe webhook
@Post('webhooks/stripe')
async handleStripeWebhook(@Req() req: RawBodyRequest<Request>) {
  const sig = req.headers['stripe-signature'];
  const rawBody = req.rawBody;  // MUST use raw body (not parsed JSON)

  // 1. VERIFY signature
  let event: Stripe.Event;
  try {
    event = this.stripe.webhooks.constructEvent(rawBody, sig, this.webhookSecret);
  } catch (err) {
    this.logger.warn('Invalid webhook signature', { error: err.message });
    throw new BadRequestException('Invalid signature');
  }

  // 2. DEDUP — check if already processed
  const exists = await this.prisma.webhookEvent.findUnique({ where: { eventId: event.id } });
  if (exists) {
    this.logger.info('Duplicate webhook, skipping', { eventId: event.id });
    return { received: true };  // Return 200 to prevent retry
  }

  // 3. PERSIST event (before processing — ensures we never lose events)
  await this.prisma.webhookEvent.create({
    data: { eventId: event.id, type: event.type, payload: event.data as any, status: 'PENDING' },
  });

  // 4. PROCESS (async — respond 200 quickly, process in background)
  await this.webhookQueue.add('process-stripe', { eventId: event.id });

  // 5. RESPOND 200 immediately (Stripe retries on non-2xx)
  return { received: true };
}
```

```python
# FastAPI — Generic webhook
@router.post("/webhooks/provider")
async def handle_webhook(request: Request):
    # 1. VERIFY signature
    body = await request.body()
    signature = request.headers.get("x-webhook-signature")

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 2. PARSE + DEDUP + PROCESS
    payload = json.loads(body)
    event_id = payload["id"]

    if await webhook_repo.exists(event_id):
        return {"received": True}

    await webhook_repo.create(event_id=event_id, payload=payload, status="PENDING")
    await queue.enqueue("process_webhook", event_id=event_id)

    return {"received": True}
```

### HMAC Signature Verification (Custom)

```typescript
// For custom webhooks (not Stripe)
function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## Webhook Processing (Background)

```typescript
// Process webhook events in background (idempotent)
@Process('process-stripe')
async handleStripeEvent(job: Job<{ eventId: string }>) {
  const record = await this.prisma.webhookEvent.findUnique({ where: { eventId: job.data.eventId } });
  if (!record || record.status === 'PROCESSED') return;

  try {
    const event = record.payload as Stripe.Event;

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      default:
        this.logger.info('Unhandled event type', { type: event.type });
    }

    await this.prisma.webhookEvent.update({
      where: { eventId: job.data.eventId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  } catch (error) {
    await this.prisma.webhookEvent.update({
      where: { eventId: job.data.eventId },
      data: { status: 'FAILED', error: error.message },
    });
    throw error; // Let BullMQ retry
  }
}

// Example handler — idempotent
private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  const order = await this.orderRepo.findById(orderId);

  if (!order) { this.logger.warn('Order not found', { orderId }); return; }
  if (order.status === 'PAID') { this.logger.info('Already paid', { orderId }); return; }  // idempotent

  await this.orderRepo.update(orderId, {
    status: 'PAID',
    paidAt: new Date(),
    paymentIntentId: paymentIntent.id,
  });

  await this.notificationQueue.add('send-payment-confirmation', { orderId });
}
```

---

## Sending Webhooks (Your API → Client)

```typescript
// Webhook delivery service
class WebhookDeliveryService {
  async deliver(subscriptionId: string, event: string, payload: any): Promise<void> {
    const subscription = await this.webhookSubRepo.findById(subscriptionId);
    if (!subscription || !subscription.isActive) return;

    const body = JSON.stringify({ id: crypto.randomUUID(), event, data: payload, timestamp: new Date() });

    // Sign the payload
    const signature = crypto.createHmac('sha256', subscription.secret).update(body).digest('hex');

    // Queue delivery with retries
    await this.deliveryQueue.add('deliver-webhook', {
      url: subscription.url,
      body,
      signature,
      subscriptionId,
      attempt: 1,
    }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60000 }, // 1m, 2m, 4m, 8m, 16m
    });
  }
}

// Delivery processor
@Process('deliver-webhook')
async handleDelivery(job: Job) {
  const { url, body, signature, subscriptionId } = job.data;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Id': JSON.parse(body).id,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status}`);
    }

    // Log successful delivery
    await this.logDelivery(subscriptionId, 'SUCCESS', response.status);
  } catch (error) {
    await this.logDelivery(subscriptionId, 'FAILED', null, error.message);

    // Disable webhook after too many consecutive failures
    if (job.attemptsMade >= 4) {
      await this.webhookSubRepo.update(subscriptionId, { isActive: false, disabledReason: 'Too many failures' });
      await this.notifyOwner(subscriptionId, 'Webhook disabled due to repeated failures');
    }

    throw error; // Let queue retry
  }
}
```

---

## Webhook Database Schema

```sql
-- Received webhook events (deduplication)
CREATE TABLE webhook_events (
  event_id    VARCHAR(255) PRIMARY KEY,  -- from provider (Stripe event ID)
  type        VARCHAR(100) NOT NULL,
  payload     JSONB NOT NULL,
  status      VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PROCESSED, FAILED
  error       TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_status ON webhook_events(status);

-- Outgoing webhook subscriptions
CREATE TABLE webhook_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  url         VARCHAR(500) NOT NULL,
  secret      VARCHAR(255) NOT NULL,     -- for HMAC signing
  events      TEXT[] NOT NULL,            -- ['order.created', 'order.paid']
  is_active   BOOLEAN DEFAULT TRUE,
  disabled_reason TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Webhook Security Checklist

```
RECEIVING:
  □ VERIFY signature (HMAC or provider-specific)
  □ USE raw body for signature verification (not parsed JSON)
  □ TIMING-SAFE comparison (crypto.timingSafeEqual)
  □ RESPOND quickly (200 within 5s, process async)
  □ DEDUP by event ID (prevent double-processing)
  □ PERSIST before processing (don't lose events on crash)
  □ IDEMPOTENT handlers (safe to process same event twice)

SENDING:
  □ SIGN payloads with HMAC-SHA256
  □ INCLUDE event ID header (for client dedup)
  □ SET timeout (10s max per delivery)
  □ RETRY with exponential backoff
  □ DISABLE after N consecutive failures + notify owner
  □ LOG all delivery attempts (success + failure)
  □ DON'T include secrets/tokens in webhook payload
```
