# BrandDrive Assessment — Bug Findings & Fixes

Below is a detailed breakdown of the bugs identified and resolved during the audit of both the backend and frontend components of the application.

---

## 1. Concurrency: Stock Allocation Race Condition
* **Location:** `backend/src/services/ordersService.js` inside `createOrder`.
* **Issue:** 
  In the original implementation, checking a product's stock (`product.stock < item.quantity`) and decrementing the stock happened in separate queries outside of a database transaction. Under concurrent order requests for the same product, two processes could read the same initial stock, bypass the stock check, and subsequently decrement the stock into a negative value, resulting in stock corruption.
  Furthermore, if an order contained multiple items and one item failed mid-transaction, previously decremented items were not rolled back, leading to a permanent stock leak.
* **Fix:** 
  1. Wrapped the entire order creation process in a transaction helper `withTransaction`.
  2. Replaced the standard query `getProductById` with `getProductByIdForUpdate` to lock the product rows.
  3. **Deadlock Prevention:** Sorted the items list by `productId` ascending before locking rows. Consistent locking order prevents mathematical cycles (deadlocks) under high concurrent load.
* **Trade-offs:** 
  Acquiring row locks (`FOR UPDATE`) locks specific products, which limits write throughput for a single product during active checkout. However, this is necessary to ensure strict data integrity.

---

## 2. SQL Injection Vulnerability in Products search
* **Location:** `backend/src/repositories/productsRepository.js` inside `listProducts`.
* **Issue:** 
  The search parameter `q` was directly interpolated into the SQL query string (`WHERE name ILIKE '%${q}%' OR sku ILIKE '%${q}%'`), allowing malicious users to execute arbitrary SQL commands (e.g. leaking data, dropping tables).
* **Fix:** 
  Refactored the query to use parameterized queries (`WHERE name ILIKE $1 OR sku ILIKE $1` with values `[%${q}%]`).
* **Trade-offs:** 
  None. Parameterized queries are standard best practice.

---

## 3. Double-Charging & Idempotency Key Race Condition
* **Location:** `backend/src/services/ordersService.js` inside `chargeOrder`.
* **Issue:** 
  Checking for the idempotency key and charging the payment gateway was not atomic. If a user sent concurrent charge requests with the same key, both would check Redis, see it doesn't exist, proceed to charge the external payment gateway twice, and then save to Redis.
  Even if they did not use an idempotency key, concurrent requests could target the same order, triggering duplicate payment gateway calls.
* **Fix:** 
  1. Implemented atomic Redis-based locking:
     - An idempotency lock key: `idem:lock:${idempotencyKey}` using the atomic `SETNX` (`NX`) with a 30-second TTL.
     - An order lock key: `lock:order:charge:${orderId}` to prevent multiple concurrent requests charging the same order with different/no keys.
  2. Wrapped database actions (storing payments, updating order status to `PAID`) in `withTransaction` and performed `getOrderByIdForUpdate` to ensure status consistency.
* **Trade-offs:** 
  Requires a running Redis instance. In a serverless/container environment, Redis becomes a critical point of synchronization.

---

## 4. Webhook Processing Duplication
* **Location:** `backend/src/services/ordersService.js` (`processPaymentWebhook`) and `schema.sql`.
* **Issue:** 
  The `payment_events` table did not have a unique constraint on `provider_event_id`. Duplicate webhook requests sent by the payment provider would create duplicate entries in the database and run the `markOrderAsPaid` logic multiple times.
* **Fix:** 
  1. Added a `UNIQUE` constraint to `provider_event_id` in `schema.sql`.
  2. Added a pre-check inside `processPaymentWebhook` using `FOR UPDATE` on `provider_event_id` to cleanly return `{ accepted: true, duplicate: true }` without crashing or throwing unique constraint violations.
* **Trade-offs:** 
  Pre-checking row existence under lock adds a small database query overhead, but prevents database unique violation error noise.

---

## 5. Broken Authentication & Data Exposure
* **Locations:** `backend/src/routes/adminRoutes.js`, `backend/src/routes/ordersRoutes.js`, and `backend/src/routes/paymentsRoutes.js`.
* **Issue:** 
  1. The entire `/admin/*` product updating endpoints had no token verification.
  2. The `GET /orders` endpoint (which lists all orders of all customers) was completely public, allowing any customer to view the global order ledger.
  3. The payment webhook `/webhook` endpoint accepted arbitrary `POST` payloads without verifying origin or signatures.
* **Fix:** 
  1. Created a robust admin authorization middleware (`requireAdmin`) that validates headers matching `Authorization: Bearer <ADMIN_TOKEN>`.
  2. Applied `requireAdmin` to `/admin/*` and the `GET /orders` endpoint.
  3. Created `verifyWebhookSignature` middleware that calculates the HMAC SHA-256 signature of the payload using a shared `WEBHOOK_SECRET` and verifies it using `crypto.timingSafeEqual` to prevent timing attacks.
* **Trade-offs:** 
  Introduces cryptographic computational overhead on webhook requests.

---

## 6. Money Handling & Float Precision Errors
* **Locations:** Both Backend and Frontend (`ordersService.js`, `CartContext.tsx`, `ProductDetailPage.tsx`).
* **Issue:** 
  1. Frontend allowed checking out with floating-point calculations, potentially leading to errors like total amount `$59.970000000000006`.
  2. Lack of backend validation allowed clients to submit arbitrary `totalAmount` payloads, meaning a malicious user could modify the total price of their order to `$0.01` before checkout.
* **Fix:** 
  1. Rounded totals to 2 decimal places using `Math.round(total * 100) / 100` on both stacks.
  2. Validated `totalAmount` on the backend by summing the unit prices from database products multiplied by requested quantities and matching it within a `$0.01` epsilon.
* **Trade-offs:** 
  None. This is critical for preventing direct financial loss.

---

## 7. Frontend Security: XSS Vulnerability
* **Location:** `frontend/src/pages/ProductDetailPage.tsx`.
* **Issue:** 
  Used `dangerouslySetInnerHTML` directly with `product.description` without sanitization. An attacker with admin permissions (or via compromising the unauthenticated admin PATCH endpoint) could inject script tags into a product's description, executing code in any user's browser.
* **Fix:** 
  Replaced `dangerouslySetInnerHTML` with child text rendering: `<p className="description">{product.description}</p>`.
* **Trade-offs:** 
  Products can no longer display formatted HTML descriptions. If rich text is required, a proper sanitizer like DOMPurify should be introduced.

---

## 8. Frontend Quality: Memory Leaks and Search Race Conditions
* **Locations:** `OrderDetailPage.tsx`, `CartPage.tsx`, and `ProductsPage.tsx`.
* **Issues:**
  1. `OrderDetailPage` used `setInterval` to poll the order status but never cleared it on unmount or status updates, causing infinite background queries. It also had no error handling for payment failures.
  2. `ProductsPage` triggered search queries on every key press, leading to fetch race conditions where slow older queries could overwrite faster newer ones.
  3. `CartPage` allowed clicking checkout multiple times, sending multiple concurrent order creations.
* **Fix:**
  1. `OrderDetailPage`: Return cleanup callback to `clearInterval`, stop polling if status transitions to terminal states (`PAID`/`FAILED`), and wrapped payments in try/catch to display errors.
  2. `ProductsPage`: Implemented a 300ms debounced search with an active cancellation flag.
  3. `CartPage`: Implemented a `checkingOut` loading state to disable the button during API execution.
