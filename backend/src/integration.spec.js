const request = require("supertest");
const crypto = require("crypto");
const app = require("./app");
const redis = require("./db/redis");
const pool = require("./db/postgres");
const ordersService = require("./services/ordersService");
const { ADMIN_TOKEN, WEBHOOK_SECRET } = require("./config/env");

describe("API & Services Integration Tests", () => {
  let testOrderId;
  let testProductId = 1;

  beforeAll(async () => {
    await redis.flushdb();
    
    let product;
    const { rows } = await pool.query("SELECT * FROM products LIMIT 1");
    if (rows.length === 0) {
      const insertRes = await pool.query(
        `INSERT INTO products (sku, name, description, price, stock)
         VALUES ('SKU-TEST', 'Test Product', 'Description', 10.00, 100)
         RETURNING id, price`
      );
      product = insertRes.rows[0];
    } else {
      product = rows[0];
    }
    
    testProductId = parseInt(product.id);
    const itemPrice = parseFloat(product.price);
    
    const orderRes = await pool.query(
      `INSERT INTO orders (customer_id, total_amount, status)
       VALUES ('customer_test', $1, 'PENDING') RETURNING id`,
      [itemPrice]
    );
    testOrderId = parseInt(orderRes.rows[0].id);

    await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES ($1, $2, 1, $3)`,
      [testOrderId, testProductId, itemPrice]
    );
  });

  afterAll(async () => {
    if (testOrderId) {
      await pool.query("DELETE FROM payment_events WHERE order_id = $1", [testOrderId]);
      await pool.query("DELETE FROM payments WHERE order_id = $1", [testOrderId]);
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [testOrderId]);
      await pool.query("DELETE FROM orders WHERE id = $1", [testOrderId]);
    }
    await redis.quit();
    await pool.end();
  });

  describe("Admin Authentication Middleware", () => {
    it("should fail to list orders (GET /orders) without authorization header", async () => {
      const res = await request(app).get("/orders");
      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Missing authorization header");
    });

    it("should fail to list orders (GET /orders) with invalid token format", async () => {
      const res = await request(app)
        .get("/orders")
        .set("Authorization", "InvalidFormat token");
      expect(res.status).toBe(401);
    });

    it("should fail to list orders (GET /orders) with incorrect token value", async () => {
      const res = await request(app)
        .get("/orders")
        .set("Authorization", "Bearer wrong-token");
      expect(res.status).toBe(403);
    });

    it("should allow listing orders (GET /orders) with correct ADMIN_TOKEN", async () => {
      const res = await request(app)
        .get("/orders")
        .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("should fail to edit products (PATCH /admin/products/:id) without authentication", async () => {
      const res = await request(app).patch(`/admin/products/${testProductId}`).send({ price: 10.0 });
      expect(res.status).toBe(401);
    });
  });

  describe("Webhook Signature Verification Middleware", () => {
    const getPayload = () => ({
      providerEventId: "evt_test_123",
      orderId: testOrderId,
      eventType: "payment_succeeded",
      payload: {},
    });

    it("should fail webhook (POST /payments/webhook) without X-Webhook-Signature header", async () => {
      const res = await request(app)
        .post("/payments/webhook")
        .send(getPayload());
      expect(res.status).toBe(401);
    });

    it("should fail webhook (POST /payments/webhook) with invalid signature header", async () => {
      const res = await request(app)
        .post("/payments/webhook")
        .set("X-Webhook-Signature", "wrongsignature123")
        .send(getPayload());
      expect(res.status).toBe(401);
    });

    it("should succeed webhook (POST /payments/webhook) with correct signature", async () => {
      const payload = getPayload();
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(payloadString)
        .digest("hex");

      const res = await request(app)
        .post("/payments/webhook")
        .set("X-Webhook-Signature", signature)
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
    });
  });

  describe("Webhook Idempotency", () => {
    it("should ignore duplicate webhooks with the same providerEventId", async () => {
      const webhookPayload = {
        providerEventId: "evt_duplicate_999",
        orderId: testOrderId,
        eventType: "payment_succeeded",
        payload: {},
      };

      const payloadString = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(payloadString)
        .digest("hex");

      const res1 = await request(app)
        .post("/payments/webhook")
        .set("X-Webhook-Signature", signature)
        .send(webhookPayload);
      expect(res1.status).toBe(200);
      expect(res1.body.duplicate).toBeUndefined();

      const res2 = await request(app)
        .post("/payments/webhook")
        .set("X-Webhook-Signature", signature)
        .send(webhookPayload);
      expect(res2.status).toBe(200);
      expect(res2.body.duplicate).toBe(true);
    });
  });

  describe("Order Processing and Validation", () => {
    it("should fail to create order if totalAmount does not match item totals", async () => {
      await expect(
        ordersService.createOrder({
          customerId: "cust_test",
          items: [{ productId: testProductId, quantity: 1 }],
          totalAmount: 9999.99,
        })
      ).rejects.toThrow("Order total mismatch");
    });

    it("should fail to create order with non-integer or negative quantity", async () => {
      await expect(
        ordersService.createOrder({
          customerId: "cust_test",
          items: [{ productId: testProductId, quantity: -2 }],
          totalAmount: 10.0,
        })
      ).rejects.toThrow("positive integer quantity");

      await expect(
        ordersService.createOrder({
          customerId: "cust_test",
          items: [{ productId: testProductId, quantity: 1.5 }],
          totalAmount: 10.0,
        })
      ).rejects.toThrow("positive integer quantity");
    });
  });

  describe("Idempotency Lock / Concurrency in Order Charging", () => {
    it("should reject concurrent charges on the same order with 409 Conflict", async () => {
      const orderRes = await pool.query(
        `INSERT INTO orders (customer_id, total_amount, status)
         VALUES ('customer_concurrent', 10.0, 'PENDING') RETURNING id`
      );
      const currentOrderId = parseInt(orderRes.rows[0].id);

      const p1 = request(app)
        .post("/payments/charge")
        .set("Idempotency-Key", `idem_key_conc_${currentOrderId}`)
        .send({ orderId: currentOrderId });

      const p2 = request(app)
        .post("/payments/charge")
        .set("Idempotency-Key", `idem_key_conc_${currentOrderId}`)
        .send({ orderId: currentOrderId });

      const [res1, res2] = await Promise.all([p1, p2]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(200);
      expect(statuses).toContain(409);

      await pool.query("DELETE FROM payments WHERE order_id = $1", [currentOrderId]);
      await pool.query("DELETE FROM orders WHERE id = $1", [currentOrderId]);
    });
  });
});
