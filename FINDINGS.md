# Findings

This document outlines the findings, root causes, impacts, fixes, and trade-offs of the audited codebase.

## Backend

### Issue: Concurrency: Stock Allocation Race Condition

- **Where:** `backend/src/services/ordersService.js:createOrder`
- **Why:** Product stock check and stock decrement were executed in separate asynchronous database queries outside a transaction block.
- **Impact:** Concurrent checkout requests could read outdated stock levels and buy products past their stock limit, driving stock into negative values. Failed multi-item checkouts did not roll back stock updates.
- **Fix:** Wrapped the entire order execution inside a database transaction, locked product rows using `SELECT ... FOR UPDATE` before verification, and sorted the items by `productId` ascending to prevent deadlocks.
- **Trade-offs:** Acquiring database row locks reduces checkout throughput for high-demand products under peak loads.

### Issue: SQL Injection in Product Search

- **Where:** `backend/src/repositories/productsRepository.js:listProducts`
- **Why:** Search query parameter `q` was directly interpolated into the SQL query string.
- **Impact:** Malicious actors could inject SQL payloads to read sensitive database records or delete tables.
- **Fix:** Refactored search to use parameterized queries (`WHERE name ILIKE $1 OR sku ILIKE $1` with values `[%${q}%]`).
- **Trade-offs:** None.

### Issue: Double-Charging & Idempotency Key Race Condition

- **Where:** `backend/src/services/ordersService.js:chargeOrder`
- **Why:** Checking the idempotency key and sending the payment request to the provider were not atomic, and concurrent transactions targeting the same order were not locked.
- **Impact:** Double clicks or network retries charged the customer multiple times.
- **Fix:** Implemented atomic Redis-based locks (`set NX EX`) on both the idempotency key and the order ID, rejecting concurrent calls with `409 Conflict`.
- **Trade-offs:** Requires an active Redis instance.

### Issue: Unauthenticated & Duplicate Webhooks

- **Where:** `backend/src/services/ordersService.js:processPaymentWebhook` & `backend/src/routes/paymentsRoutes.js`
- **Why:** The webhook endpoint was fully public, and the `payment_events` table lacked unique constraints.
- **Impact:** Anyone could fake payment success webhooks. Payment provider retry requests duplicated payment records and paid state updates.
- **Fix:** timing-safe HMAC SHA-256 signature verification middleware and a unique database constraint on `provider_event_id`.
- **Trade-offs:** Cryptographic verification adds minor CPU execution time per webhook.

### Issue: Unauthenticated Admin Routes and Global Order Ledger Exposure

- **Where:** `backend/src/routes/adminRoutes.js` & `backend/src/routes/ordersRoutes.js`
- **Why:** Admin update endpoints and the global order listing lacked any authentication.
- **Impact:** Customers could view other customers' private details and modify store product records.
- **Fix:** Added `requireAdmin` middleware validating the `Authorization: Bearer <ADMIN_TOKEN>` header.
- **Trade-offs:** None.

### Issue: Mismatched Cart Total Mismatches (Price Spoofing)

- **Where:** `backend/src/services/ordersService.js:createOrder`
- **Why:** The server did not verify that the total amount submitted matched the actual price of the products in the database.
- **Impact:** Clients could spoof order prices (e.g. purchasing a $1,000 product for $0.01).
- **Fix:** Recalculated the expected total from database records on checkout and rejected mismatches.
- **Trade-offs:** Extra database query per checkout.

---

## Frontend

### Issue: Cross-Site Scripting (XSS) in Product Detail Page

- **Where:** `frontend/src/pages/ProductDetailPage.tsx`
- **Why:** Rendered description using `dangerouslySetInnerHTML`.
- **Impact:** Attackers who compromise product records could execute arbitrary javascript code in users' browsers.
- **Fix:** Replaced with safe text child nodes (`<p>{product.description}</p>`).
- **Trade-offs:** Descriptions can no longer contain formatted HTML.

### Issue: Memory Leak in Order Polling

- **Where:** `frontend/src/pages/OrderDetailPage.tsx`
- **Why:** The `setInterval` polling hook had no cleanup function and continued fetching order details indefinitely.
- **Impact:** Unnecessary network requests and browser memory leaks.
- **Fix:** Returned a clearInterval cleanup function in the `useEffect` hook and cleared polling once the order transitioned to a terminal state (`PAID` or `FAILED`).
- **Trade-offs:** None.

### Issue: Search Key-press Race Conditions

- **Where:** `frontend/src/pages/ProductsPage.tsx`
- **Why:** Every keystroke immediately triggered a new fetch request.
- **Impact:** Older slow network requests could overwrite newer search results.
- **Fix:** Implemented a 300ms debounced search useEffect hook with an active request-cancellation flag.
- **Trade-offs:** Small latency (300ms) introduced between typing and fetching.

### Issue: Checkout Double-Submit

- **Where:** `frontend/src/pages/CartPage.tsx`
- **Why:** The checkout submit button remained active during processing.
- **Impact:** Double clicks sent duplicate concurrent checkout requests.
- **Fix:** Disabled the button and displayed a "Processing..." text while checkout API requests are pending.
- **Trade-offs:** None.

---

## Cross-cutting

### Issue: Floating Point Precision Errors

- **Where:** Backend (`ordersService.js`) & Frontend (`CartContext.tsx` / `ProductDetailPage.tsx`)
- **Why:** Fractional calculations with standard javascript floats.
- **Impact:** Broken cart arithmetic (e.g. totals displaying as `$39.980000000000004`).
- **Fix:** Rounded all currency calculations to 2 decimal places: `Math.round(total * 100) / 100`.
- **Trade-offs:** None.
