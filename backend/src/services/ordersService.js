const ordersRepository = require("../repositories/ordersRepository");
const productsRepository = require("../repositories/productsRepository");
const paymentsRepository = require("../repositories/paymentsRepository");
const paymentGateway = require("./paymentGateway");
const redis = require("../db/redis");
const db = require("../db/postgres");

async function withTransaction(callback) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createOrder({ customerId, items, totalAmount }) {
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    const error = new Error("customerId and items are required");
    error.status = 400;
    throw error;
  }

  const sortedItems = [...items].sort((a, b) => Number(a.productId) - Number(b.productId));

  return withTransaction(async (client) => {
    const enrichedItems = [];
    for (const item of sortedItems) {
      if (!item.productId || typeof item.quantity !== "number" || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        const error = new Error("Each item must have a valid productId and a positive integer quantity");
        error.status = 400;
        throw error;
      }

      const product = await productsRepository.getProductByIdForUpdate(item.productId, client);
      if (!product) {
        const error = new Error(`Product ${item.productId} not found`);
        error.status = 404;
        throw error;
      }
      if (product.stock < item.quantity) {
        const error = new Error(`Insufficient stock for ${product.name}`);
        error.status = 409;
        throw error;
      }
      enrichedItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: Number(product.price),
      });
    }

    let calculatedTotal = 0;
    for (const item of enrichedItems) {
      calculatedTotal += item.quantity * item.unitPrice;
    }
    calculatedTotal = Math.round(calculatedTotal * 100) / 100;

    if (Math.abs(calculatedTotal - Number(totalAmount)) > 0.01) {
      const error = new Error(`Order total mismatch. Calculated: ${calculatedTotal}, received: ${totalAmount}`);
      error.status = 400;
      throw error;
    }

    for (const item of enrichedItems) {
      await productsRepository.decrementStock(
        item.productId,
        item.quantity,
        client,
      );
    }

    const order = await ordersRepository.createOrder({
      customerId,
      totalAmount: calculatedTotal,
      items: enrichedItems,
    }, client);

    return order;
  });
}

async function chargeOrder({ orderId, idempotencyKey }) {
  if (idempotencyKey) {
    const cached = await redis.get(`idem:${idempotencyKey}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const lockKey = `idem:lock:${idempotencyKey}`;
    const acquired = await redis.set(lockKey, "processing", "NX", "EX", 30);
    if (!acquired) {
      const error = new Error("Payment is already in progress");
      error.status = 409;
      throw error;
    }
  }

  const orderLockKey = `lock:order:charge:${orderId}`;
  const orderLockAcquired = await redis.set(orderLockKey, "processing", "NX", "EX", 30);
  if (!orderLockAcquired) {
    if (idempotencyKey) {
      await redis.del(`idem:lock:${idempotencyKey}`);
    }
    const error = new Error("Payment for this order is already in progress");
    error.status = 409;
    throw error;
  }

  try {
    const order = await ordersRepository.getOrderById(orderId);
    if (!order) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    if (order.status !== "PENDING") {
      const error = new Error("Only pending orders can be charged");
      error.status = 409;
      throw error;
    }

    const gatewayResponse = await paymentGateway.charge({
      orderId: order.id,
      amount: order.totalAmount,
    });

    const result = await withTransaction(async (client) => {
      const lockedOrder = await ordersRepository.getOrderByIdForUpdate(order.id, client);
      if (!lockedOrder) {
        throw new Error("Order not found during transaction");
      }
      if (lockedOrder.status !== "PENDING") {
        throw new Error("Order is no longer pending");
      }

      const payment = await paymentsRepository.createPayment({
        orderId: order.id,
        amount: gatewayResponse.chargedAmount,
        providerTxnId: gatewayResponse.providerTxnId,
        status: "SUCCESS",
        idempotencyKey,
      }, client);

      const updatedOrder = await ordersRepository.markOrderAsPaid(order.id, client);

      return { order: updatedOrder, payment };
    });

    if (idempotencyKey) {
      await redis.set(
        `idem:${idempotencyKey}`,
        JSON.stringify(result),
        "EX",
        3600,
      );
    }

    return result;
  } finally {
    await redis.del(orderLockKey);
    if (idempotencyKey) {
      await redis.del(`idem:lock:${idempotencyKey}`);
    }
  }
}

async function processPaymentWebhook({
  providerEventId,
  orderId,
  eventType,
  payload,
}) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT id FROM payment_events WHERE provider_event_id = $1 FOR UPDATE",
      [providerEventId],
    );
    if (existing.rows.length > 0) {
      return { accepted: true, duplicate: true };
    }

    try {
      await paymentsRepository.createWebhookEvent({
        providerEventId,
        orderId,
        eventType,
        payload,
      }, client);
    } catch (err) {
      if (err.code === "23505") {
        return { accepted: true, duplicate: true };
      }
      throw err;
    }

    if (eventType === "payment_succeeded") {
      const order = await ordersRepository.getOrderByIdForUpdate(orderId, client);
      if (order && order.status === "PENDING") {
        await ordersRepository.markOrderAsPaid(orderId, client);
      }
    }

    return { accepted: true };
  });
}

async function getOrderById(orderId) {
  const order = await ordersRepository.getOrderWithDetails(orderId);
  if (!order) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }
  return order;
}

async function listOrders(params) {
  return ordersRepository.listOrders(params);
}

module.exports = {
  createOrder,
  chargeOrder,
  processPaymentWebhook,
  getOrderById,
  listOrders,
};
