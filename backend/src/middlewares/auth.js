const crypto = require("crypto");
const { ADMIN_TOKEN, WEBHOOK_SECRET } = require("../config/env");

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Invalid authorization format" });
  }

  const token = parts[1];
  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "Forbidden: Invalid admin token" });
  }

  next();
}

function verifyWebhookSignature(req, res, next) {
  const signature = req.header("X-Webhook-Signature");
  if (!signature) {
    return res.status(401).json({ error: "Missing webhook signature" });
  }

  // Calculate HMAC SHA256 of the raw body/stringified body
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  next();
}

module.exports = {
  requireAdmin,
  verifyWebhookSignature,
};
