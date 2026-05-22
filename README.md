# Fullstack Assessment - Senior (Node.js/Express + React/TypeScript)

This repository is a pre-interview fullstack assessment starter.

The system is partially working, but contains hidden logical bugs across the
backend and the frontend. There are no syntax traps. Focus is on correctness
under concurrency and failure on the backend, and on state, security, and UX
correctness on the frontend.

## Scenario

A small storefront / admin dashboard for an order platform.

- Customers browse products with stock
- Customers create an order (which reserves stock)
- Customers pay an order via a fake payment gateway
- A payment webhook updates order status
- Admins can view orders and adjust products

Some cases can lead to:

- overselling stock under concurrent orders
- double-charging an order
- duplicate webhooks marking the same order paid twice
- the UI displaying stale or inconsistent state
- the UI silently dropping errors or accepting unsafe input

## Tech

- Backend: Node.js + Express, PostgreSQL, Redis (idempotency cache)
- Frontend: React + TypeScript + Vite
- Docker Compose for Postgres and Redis

Candidates may replace parts with their preferred approach if justified.

## Run

The repository is two apps: `backend/` and `frontend/`. Install both.

1. Start infra:

```bash
docker compose up -d
```

2. Backend:

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The API runs on `http://localhost:3000`.

3. Frontend (in a separate terminal):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The web app runs on `http://localhost:5173`.

Health endpoints:

```bash
GET http://localhost:3000/health
```

## API Endpoints

- `GET /products` - list products (supports `?q=` search)
- `GET /products/:id`
- `POST /orders`
  - body: `{ "customerId": "customer_001", "items": [{ "productId": 1, "quantity": 2 }], "totalAmount": 199.98 }`
- `GET /orders/:id`
- `GET /orders` - admin: list orders
- `POST /payments/charge`
  - body: `{ "orderId": 1 }`
  - optional header: `Idempotency-Key: abc-123`
- `POST /payments/webhook`
  - body: `{ "providerEventId": "evt-1", "orderId": 1, "eventType": "payment_succeeded", "payload": {} }`
- `POST /admin/products` - admin: create product
- `PATCH /admin/products/:id` - admin: update product (price, stock, description)

## Frontend Surfaces

- `/` - storefront product list
- `/products/:id` - product detail with "Add to cart" / "Buy now"
- `/cart` - cart review + checkout
- `/orders/:id` - order detail with payment status (auto-refresh)
- `/admin` - admin orders dashboard + product editing

## Candidate Task (8h max)

1. Identify as many critical logical / data-integrity / security / UX issues as
   you can across the backend AND the frontend.
2. Fix the issues with production-appropriate changes.
3. Add tests proving fixes for at least the highest-impact backend bugs
   (concurrency, idempotency, auth) and at least one frontend bug.
4. Write a short `FINDINGS.md` covering:
   - what issues were found
   - why they happen
   - why your fix is safe
   - what trade-offs remain
5. Submit `AI_NOTES.md` (see "AI Usage" section below). This is required.

## AI Usage (required)

We assume you will use AI tooling. We are evaluating your ability to use AI
**well**, not whether you used it. Naive AI usage will produce code that
appears to work but contains the same class of bugs we deliberately seeded.

Submit an `AI_NOTES.md` with the following sections:

1. **Tools used** - which AI assistants / IDEs you used.
2. **Prompt journal** - 3 to 5 of the most useful prompts you wrote, copied
   verbatim, with a short note on what the model produced and what you kept
   or rejected.
3. **AI got it wrong** - at least one concrete example where the model gave a
   plausible-looking but incorrect, insecure, or unsafe answer, and how you
   detected and corrected it. Quote the offending output.
4. **Validation strategy** - how you verified AI-generated code (tests,
   manual reasoning, docs you cross-referenced, what you ran).
5. **What you did NOT delegate** - decisions you made yourself and why,
   especially around money handling, auth, security, and concurrency.

We pay specific attention to whether the candidate noticed and rejected AI
output for at least one of: monetary arithmetic, authorization, rendering
untrusted HTML, or background polling cleanup. These are well-known AI failure
modes and are present in this repo on purpose.

## Evaluation Focus

- Correctness and data integrity (overselling, double-charge, dedup)
- Concurrency safety
- Retry / idempotency behavior
- Frontend state correctness (stale state, fetch races, optimistic updates)
- Frontend security (XSS, token storage, auth boundaries)
- Frontend UX (error handling, accessibility, double-submit)
- Quality of tests and reasoning
- Practical production judgment
- Quality of AI usage (per `AI_NOTES.md`)

## Submission

Push your work to a private repo and share access, or submit a zip. Include:

- `FINDINGS.md`
- `AI_NOTES.md`
- All test files
- Any infra changes (migrations, env, scripts)
