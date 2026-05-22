# AI Usage Notes

## 1. Tools used

- Claude Code
- VS Code
- Vitest / Jest

## 2. Prompt journal

### Prompt 1

```
Fix the SQL Injection in productsRepository.js. Re-parameterize the query.
```

- **Model Output:** Parameterized query for search: `const { rows } = await client.query('SELECT ... WHERE name ILIKE $1 OR sku ILIKE $1', ['%' + q + '%'])`.
- **Kept/Rejected:** Kept entirely. It properly sanitized the input and separated code execution from text parameters.

### Prompt 2

```
Implement transaction wrapper withTransaction and secure getProductByIdForUpdate with FOR UPDATE locking in ordersService.js to handle stock concurrency.
```

- **Model Output:** Provided transaction block using pg client pool. Handled row locking on checkout items.
- **Kept/Rejected:** Kept, but modified the sorting logic. The model didn't sort products by ID, which could lead to deadlocks if two checkouts hit the same items in different order. Added ascending item sorting before locking.

### Prompt 3

```
Add Redis-based locking inside chargeOrder using idempotency keys.
```

- **Model Output:** Standard redis key checking.
- **Kept/Rejected:** Kept the lock logic but corrected the release flow. If order lock fails, we must delete the idempotency key lock first, otherwise the key is stuck in processing for the TTL.

### Prompt 4

```
Refactor ProductsPage search to debounce key inputs.
```

- **Model Output:** A debounced fetch implementation.
- **Kept/Rejected:** Kept, but refactored to use an active flag pattern inside `useEffect` cleanup to cancel out-of-order fetches.

## 3. AI got it wrong

In `integration.spec.js` setup:
```javascript
  describe("Webhook Signature Verification Middleware", () => {
    const webhookPayload = {
      providerEventId: "evt_test_123",
      orderId: 1,
      eventType: "payment_succeeded",
      payload: {},
    };
```

- **What was wrong:** The AI assumed `orderId: 1` would exist. In clean test runs, the order ID is dynamic and database-assigned. This triggered database foreign key constraint violations (`payment_events_order_id_fkey`).
- **How it was found:** Running integration tests resulted in a 500 error and a database foreign key violation print.
- **What it was replaced with:** Replaced with a dynamic helper function `getPayload()` that returns the database-created `testOrderId` after the setup hooks populate it.

## 4. Validation strategy

- **Integration Testing:** Wrote Jest/Supertest integration suite verifying signature verification, admin auth, concurrency charging, and webhook idempotency.
- **Component Testing:** Wrote Vitest unit tests verifying double-click disables and XSS plaintext fallback behavior.
- **Manual verification:** Checked SQLite/Postgres logs, validated that admin pages restrict access without tokens, and verified that negative quantities and mismatched prices return correct validation errors.

## 5. What you did NOT delegate

- **Locking & Deadlock prevention:** I manually sorted cart item arrays by ID prior to row locking. Standard models do not natively reason about database lock order deadlocks under concurrency.
- **Money calculations:** Manually forced float roundings to the nearest cent on both sides because LLMs struggle with IEEE 754 precision issues.
- **HMAC Signature parsing:** Manually verified buffer lengths before executing `timingSafeEqual` comparison to block timing attack vectors.
