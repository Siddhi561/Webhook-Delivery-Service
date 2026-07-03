# Webhook Delivery Service

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express)
![BullMQ](https://img.shields.io/badge/BullMQ-Job%20Queue-FF6B00?style=for-the-badge)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)


<p align="center">
  <img src="docs/images/banner.png" width="100%">
</p>
A production-style webhook delivery system that notifies registered endpoints when events occur, with automatic retries, HMAC payload signing, and full delivery history tracking. Built to demonstrate how services like Stripe, GitHub, and Razorpay implement reliable webhook infrastructure.

---

## Why This Exists

When something happens in your system — payment completed, user created — other services need to know. The naive approach of calling their URLs directly in the request handler fails silently when their server is down. This system reduces notification loss through a queue-based architecture with retry logic. Each delivery is tracked and retried independently.

---

## How It Works

```
POST /api/events/trigger { event: "payment.completed", payload: {...} }
        ↓
Find all active webhooks subscribed to this event
        ↓
For each webhook:
  Create Delivery record in MongoDB (status: pending)
  Add independent job to BullMQ queue
        ↓
Return 202 immediately — don't wait for delivery
        ↓
Worker picks up each job independently
        ↓
Sign payload with HMAC SHA256 using webhook secret
POST to registered URL with signature header
        ↓
200-299 → mark delivery success
4xx/5xx → throw → BullMQ retries (5s → 25s → 125s → 625s → 3125s)
All 5 retries fail → mark delivery permanently failed
```

---

## Architecture

<p align="center">
  <img src="docs/images/technical architecture.png" width="70%">
</p>

---

## Dashboard

A dark-themed developer dashboard is included at `public/index.html`. It is served automatically by Express when you run the project.

**What it does:**
- Shows live stats — total webhooks registered, successful deliveries, failed deliveries
- Register new webhooks with URL, secret, events, and description
- Lists all registered webhooks with their subscribed events and active/inactive status
- Trigger any event with a JSON payload — includes preset payloads for common events
- View paginated delivery history per webhook with HTTP status, attempt count, response body, and error messages
- Deactivate webhooks without deleting delivery history

Open `http://localhost:4000` after running `npm run dev:all`.


<p align="center">
  <img src="docs/images/dashboard.png" width="100%">
</p>


---

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js 18+ (ESM) | Runtime — uses native `import/export`, no CommonJS |
| Express | HTTP server |
| BullMQ | Job queue — handles retries, backoff, priority |
| Redis 7 (Docker) | Queue storage — BullMQ requires Redis 5+ |
| MongoDB (Atlas) | Webhook registration and delivery history |
| Mongoose | MongoDB ODM |
| Axios | Outbound HTTP delivery to registered URLs |
| Zod | Request validation with detailed error messages |
| Winston | Structured JSON logging |
| concurrently | Runs API and worker together in development |

---

## Features

- **Queue-based delivery** — survives API restarts and worker crashes
- **Independent retries** — each webhook retried separately, one failure does not affect others
- **HMAC SHA256 signing** — every request signed with webhook secret and timestamp
- **Replay attack prevention** — timestamp header lets receivers reject requests older than 5 minutes
- **Full delivery history** — every attempt recorded with status, HTTP response code, response body
- **Pagination** — delivery history paginated and filterable by status
- **Webhook management** — register, list, and deactivate webhooks via API
- **Structured logging** — every delivery attempt logged with Winston in JSON format
- **Dashboard UI** — dark-themed developer interface for managing and testing the full flow
- **Database seeder** - with realistic webhook subscriptions and delivery history

---

## Exponential Backoff

<p align="center">
  <img src="docs/images/exponential backoff.png" width="60%">
</p>


## Single Webhook Delivery Attempt

<p align="center">
  <img src="docs/images/single webhook delivery attempt.png" width="60%">
</p>


## Project Structure

```
webhook-service/
├── docs/
│   ├── images/                                   # Architecture diagrams, screenshots
│   └── Webhook.postman_collection.json   # Postman API collection
│
├── public/
│   └── index.html                                # Developer dashboard UI
│
├── src/
│   ├── config/
│   │   ├── db.js                                 # MongoDB connection
│   │   ├── logger.js                             # Winston structured logger
│   │   └── redis.js                              # Redis connection with retry strategy
│   │
│   ├── controllers/
│   │   ├── event.controller.js                   # Thin HTTP handler → eventService
│   │   └── webhook.controller.js                 # Thin HTTP handlers → webhookService
│   │
│   ├── middleware/
│   │   ├── asyncHandler.js                       # Async error wrapper
│   │   ├── errorHandler.js                       # Global error handler
│   │   └── validate.js                           # Zod validation middleware
│   │
│   ├── models/
│   │   ├── delivery.js                           # Delivery schema
│   │   └── webhook.js                            # Webhook schema
│   │
│   ├── queues/
│   │   └── webhookQueue.js                       # BullMQ queue definition
│   │
│   ├── routes/
│   │   ├── event.route.js                        # Event trigger routes
│   │   └── webhook.route.js                      # Webhook CRUD routes
│   │
│   ├── seeders/
│   │   └── seed.js                               # Seed demo webhooks and deliveries
│   │
│   ├── services/
│   │   ├── deliveryService.js                    # HMAC signing and webhook delivery
│   │   ├── eventService.js                       # Event publishing and queue logic
│   │   └── webhookService.js                     # Webhook CRUD business logic
│   │
│   ├── workers/
│   │   └── webhookWorker.js                      # BullMQ job processor
│   │
│   └── app.js                                    # Express app entry point
│
├── .env.example                                  # Environment variables template
├── .gitignore                                    # Git ignore rules
├── LICENSE                                       # MIT License
├── package.json
├── package-lock.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker — for running Redis 7 locally
- MongoDB database — [Atlas](https://www.mongodb.com/atlas) free tier works

### Setup

```bash
git clone https://github.com/Siddhi561/Webhook-Delivery-Service
cd webhook-service
npm install

# Start Redis 7 via Docker (BullMQ requires Redis 5+)
docker run -d --name redis-queue -p 6379:6379 redis:7
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=4000
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/webhooks
LOG_LEVEL=info
```
## Demo Seed Data

To make testing easier, the project includes a database seeder that populates realistic demo data.

### Seed Commands

```bash
# Insert demo data
npm run seed

# Remove all seeded data
npm run seed:clear

# Reset the database
npm run seed:clear && npm run seed
```

### What the Seeder Creates

- 2 webhook subscriptions
  - 1 Active
  - 1 Inactive

- 6 delivery records across both webhooks

Including:

- Successful deliveries
- Failed deliveries
- Pending deliveries
- Multiple event types
- Realistic request payloads and responses

### Dashboard After Seeding

Once seeded, open:

http://localhost:4000

You'll see:

- Dashboard statistics already populated
- Active webhook with:
  - 2 Successful deliveries
  - 1 Failed delivery
  - 1 Pending delivery
- Inactive webhook with:
  - 1 Successful delivery
  - 1 Failed delivery

### Delivery History

The seeder prints both webhook IDs to the terminal.
Copy either ID and paste it into the **Delivery History** section of the dashboard to instantly view delivery records without opening MongoDB Atlas.


### Run

```bash
npm run dev:all    # starts API + worker together (recommended)
npm run dev        # API only
npm run dev:worker # worker only
```

You should see:

```
[0] info: Redis connected
[0] info: MongoDB connected
[0] info: Server started { port: 4000 }
[1] info: Redis connected
[1] info: MongoDB connected
[1] info: Worker ready
```

Open `http://localhost:4000` for the dashboard.

---

## API Reference

### POST /api/webhooks/create
Register a new webhook endpoint.

**Request body:**
```json
{
  "url": "https://your-site.com/webhook",
  "secret": "your-secret-min-8-chars",
  "events": ["payment.completed", "refund.issued"],
  "description": "Production webhook"
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "id": "64abc123...",
    "url": "https://your-site.com/webhook",
    "events": ["payment.completed", "refund.issued"],
    "secret": "your-secret",
    "createdAt": "2026-04-20T10:00:00.000Z"
  }
}
```

> Secret is returned only at creation. Store it securely — it cannot be retrieved again.

---

### GET /api/webhooks
List all registered webhooks. Secret field excluded from response.

---

### DELETE /api/webhooks/delete/:id
Soft deactivate a webhook. Record is preserved in DB, delivery history is not lost.

**Response `200`:**
```json
{
  "success": true,
  "message": "Webhook deactivated",
  "data": { "id": "64abc123...", "isActive": false }
}
```

---

### GET /api/webhooks/:id/deliveries
Get paginated delivery history for a webhook.

**Query params:** `status` (pending / success / failed), `page`, `limit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "event": "payment.completed",
      "status": "success",
      "attempts": 2,
      "responseStatus": 200,
      "responseBody": "{\"received\":true}",
      "completedAt": "2026-04-20T10:00:05.000Z"
    }
  ],
  "pagination": { "total": 45, "page": 1, "limit": 20, "pages": 3 }
}
```

---

### POST /api/events/trigger
Fire an event and notify all subscribed webhooks.

**Request body:**
```json
{
  "event": "payment.completed",
  "payload": {
    "orderId": "ORD123",
    "amount": 500,
    "currency": "INR"
  }
}
```

**Response `202`:**
```json
{
  "success": true,
  "message": "Event queued for 2 webhook(s)",
  "event": "payment.completed",
  "deliveriesCreated": 2,
  "deliveryIds": ["64def456...", "64def789..."]
}
```

---

### GET /health
```json
{ "status": "ok", "timestamp": "2026-04-20T10:00:00.000Z" }
```

---

## Signature Verification

Every delivery request includes these headers:

```
X-Webhook-Event: payment.completed
X-Webhook-Signature: sha256=a9f3c2b1...
X-Webhook-Timestamp: 1713607200000
```

To verify on the receiving end (Node.js):

```javascript
import crypto from 'crypto';

const verifyWebhook = (req, secret) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const body = JSON.stringify(req.body);

  // reject requests older than 5 minutes — prevents replay attacks
  if (Date.now() - Number(timestamp) > 5 * 60 * 1000) {
    throw new Error('Webhook timestamp too old');
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // timingSafeEqual prevents timing attacks — never use === for signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
};
```

---

## Data Models

### Webhook
| Field | Type | Description |
|---|---|---|
| url | String | Target URL to POST to |
| secret | String | HMAC signing secret — never returned after creation |
| events | [String] | Event names this webhook subscribes to |
| isActive | Boolean | false = deactivated, skipped when events fire |
| description | String | Optional label |
| createdAt / updatedAt | Date | Auto-managed by Mongoose |

### Delivery
| Field | Type | Description |
|---|---|---|
| webhookId | ObjectId | Reference to parent Webhook |
| event | String | Event name that triggered this delivery |
| payload | Mixed | The data that was sent |
| status | String | pending / success / failed |
| attempts | Number | How many times delivery was attempted |
| responseStatus | Number | HTTP status code from target server |
| responseBody | String | First 500 chars of target server response |
| errorMessage | String | Network/timeout error if request never reached target |
| nextRetryAt | Date | When next retry is scheduled |
| completedAt | Date | When job succeeded or permanently failed |

---

## Key Design Decisions

**Why one job per webhook and not one job for all subscribers?**
If one delivery fails, it retries independently without affecting the others. A single shared job would require retrying all subscribers when only one is down.

**Why `validateStatus: () => true` in axios?**
Axios throws by default on 4xx/5xx responses. But a 500 from the target server is their failure — you want to record it and retry, not crash your worker. This setting makes axios return the response regardless of status code, and you decide what to do with it.

**Why MongoDB instead of PostgreSQL?**
Delivery records have variable-shape data — response bodies differ per target server, error messages only exist on failures, nextRetryAt only exists on pending jobs. MongoDB handles document variability better. PostgreSQL would need many nullable columns for the same structure.

**Why sign the stringified body and not the object?**
The signature must match exactly what gets transmitted over the wire. JavaScript objects can serialize in different key orders. Signing the string guarantees the receiver can reproduce the exact same bytes.

**Why separate service files instead of putting logic in controllers?**
Controllers are thin — they handle the HTTP request and response only. All DB queries, queue calls, and business logic live in service files. This means controllers stay under 15 lines and logic is testable without spinning up an HTTP server.

---

## Common Issues

| Error | Cause | Fix |
|---|---|---|
| `Redis version needs to be >= 5.0.0` | Windows native Redis (v3) is running on port 6379 | Run `net stop Redis` in admin CMD, then `docker start redis-queue` |
| `OverwriteModelError: Cannot overwrite Webhook model` | `--watch` hot reload re-registers Mongoose models | Use `mongoose.models.Webhook \|\| mongoose.model(...)` pattern in model files |
| `ERR_MODULE_NOT_FOUND` for route files | File not created or wrong path | Check `src/routes/` contains both route files |
| `Internal server error` with no terminal output | Zod v4 breaking change — `err.errors` renamed to `err.issues` | Use `err.issues \|\| err.errors \|\| []` in errorHandler |
| Dashboard shows unstyled plain text | Served as Claude artifact — CSS variables don't exist outside Claude | Serve `public/index.html` from Express using `express.static` |

---

## What I Would Add in Production

- **Idempotency keys** — prevent duplicate deliveries when the same job is retried after a partial success
- **Circuit breaker** — stop retrying a URL that has failed consistently, resume after a cooldown
- **Secret rotation** — let clients update secrets without deleting and recreating the webhook
- **Dead letter review UI** — admin interface to inspect permanently failed deliveries and re-queue them
- **Alerting** — notify when a webhook accumulates repeated failures across a time window

---
## 👨‍💻 Author

Built as a backend engineering portfolio project demonstrating scalable webhook delivery, asynchronous job processing with BullMQ, Redis-backed queues, HMAC request signing, retry mechanisms with exponential backoff, delivery tracking, and production-inspired API architecture.

If you found this project useful, consider giving it a ⭐.

