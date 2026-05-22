const express = require("express");
const ordersService = require("../services/ordersService");
const { verifyWebhookSignature } = require("../middlewares/auth");

const router = express.Router();

router.post("/charge", async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const idempotencyKey = req.header("Idempotency-Key");
    const result = await ordersService.chargeOrder({ orderId, idempotencyKey });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/webhook", verifyWebhookSignature, async (req, res, next) => {
  try {
    const { providerEventId, orderId, eventType, payload } = req.body;
    const result = await ordersService.processPaymentWebhook({
      providerEventId,
      orderId,
      eventType,
      payload,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
