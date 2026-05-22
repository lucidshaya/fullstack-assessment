Fullstack Assessment Summary (Reviewer Notes)

This document is for the reviewer. It is not part of the candidate's task.
Do not share this file with candidates.

Overview

The starter is a small storefront + admin order platform. It is intentionally
"partially working." It compiles, runs, and the happy path passes a casual
manual test, but it carries seeded bugs across the backend and the frontend
that surface under concurrency, retries, and adversarial input.

It also evaluates the candidate's ability to use AI tooling well. Several of
the seeded bugs match well-known AI failure modes (money math, auth,
HTML rendering, polling without cleanup). A candidate who delegates to AI
without review will tend to leave them in or even introduce more.

Backend bugs to look for

1. Order creation does not lock product rows. Concurrent orders can oversell
   stock. Fix: SELECT FOR UPDATE on each product row inside a transaction,
   then check stock and decrement atomically. Sort lock acquisition by
   product id to avoid deadlocks.

2. Order total is taken from the request body. Client tampering trivially
   underpays. Fix: compute total server-side from product prices.

3. Validation of stock happens after a separate read, not under lock,
   creating a TOCTOU window even if a lock is later added partially.

4. Idempotency key is checked only in Redis. Cache miss + concurrent request
   leads to two charges. Fix: rely on a UNIQUE DB constraint on
   payments.idempotency_key and handle 23505. Redis is a fast-path cache.

5. Webhook handler does not enforce uniqueness on provider_event_id at the
   DB level (column is not unique in the seeded schema), so duplicate
   webhooks process twice. Fix: add unique constraint and handle 23505.

6. Payment creation and order status update are not in one transaction.
   Crash between them leaves order PENDING with a SUCCESS payment.

7. Money is handled as JS Number in places. Use a decimal library or
   integer minor units, or rely on numeric in pg with strings.

8. Admin endpoints have no auth. Anyone can mutate products.

9. /products?q= uses string interpolation. SQL injection vector.

10. CORS is wide open with credentials. Lock to the frontend origin.

11. Webhook payload is trusted as-is (no signature check). Should accept a
    signed header and verify HMAC.

Frontend bugs to look for

1. Buy / checkout button is not disabled while the request is in flight.
   Double-click submits twice. Combined with backend idempotency bugs this
   produces duplicate orders and double charges. Fix: disable button +
   send Idempotency-Key + use a stable client request id.

2. Cart total is computed in the browser and sent in the request body. Even
   if the server is fixed, the UI displays a number that may diverge.
   Show server-computed totals.

3. Product list useEffect has missing dependency on the search query, so
   stale closure refetches the wrong term after rapid typing.

4. Search has a fetch race: older slower responses overwrite newer faster
   ones. Fix: AbortController or response sequence guard.

5. Order detail polls with setInterval but does not clear on unmount.
   Memory leak; continues hitting the API after navigation.

6. Product description is rendered with dangerouslySetInnerHTML against a
   field that admins can edit. XSS. Fix: sanitize or render as text.

7. Lists use array index as key. Reorders / deletions cause wrong UI state.

8. Auth token (admin) is in localStorage and never cleared on logout.
   Discuss tradeoffs (httpOnly cookie preferred for session).

9. Form fields lack labels / aria; inputs not associated with their text.

10. Errors from fetch are swallowed - the UI shows nothing on failure.

11. Optimistic update on "mark order paid" does not roll back on failure.

12. Admin route is not gated client-side. Anyone hitting /admin sees it.
    The real fix is server-side auth (item 8 in backend), but the UI should
    also gate the route.

AI evaluation

Candidates must submit AI_NOTES.md. Look for:

- Did they notice the money-as-Number trap? Most AI suggestions will use
  Number / parseFloat. A good candidate moves to integer minor units or
  a decimal lib and explains why.
- Did they catch dangerouslySetInnerHTML? Many AI assistants happily insert
  this when asked to "render rich product descriptions."
- Did they add server-side auth, not just client-side hide?
- Did they implement polling cleanup with proper effect cleanup or switch
  to a query library / SSE / WebSocket?
- Quality of the prompt journal: are prompts specific, do they include the
  constraint set, do they mention the threat model?
- Did they document at least one case where AI produced a wrong answer?

Trade-offs candidates may flag

- Row locks may add latency under contention. Acceptable for the volume.
- Webhook signature verification requires a shared secret; we did not
  provide one - candidate should note this and stub it.
- httpOnly cookie auth requires a cookie-based session; candidate may
  document this as a follow-up rather than fully implement.

Scoring rubric (suggested)

- Backend correctness: 35
- Frontend correctness + security: 25
- Tests: 15
- Reasoning quality (FINDINGS.md): 10
- AI usage quality (AI_NOTES.md): 15
