const Redis = require("ioredis");
const { REDIS_URL } = require("../config/env");

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("Redis error", err.message);
});

module.exports = redis;
