// src/models/BotBlockLog.js
import mongoose from "mongoose";
import { config } from "../config.js";

const getBotBlockLogTtlSeconds = () => {
  const days = Number(config?.botBlock?.logTtlDays ?? 30);

  const safeDays = Number.isFinite(days) && days > 0 ? days : 30;

  return safeDays * 24 * 60 * 60;
};

const BotBlockLogSchema = new mongoose.Schema(
  {
    fingerprint: {
      type: String,
      index: true,
    },

    ip: {
      type: String,
      index: true,
    },

    method: String,

    path: {
      type: String,
      index: true,
      maxlength: 2048,
    },

    decodedPath: String,
    originalUrl: { type: String, maxlength: 2048 },

    query: mongoose.Schema.Types.Mixed,

    userAgent: { type: String, maxlength: 512 },
    referer: { type: String, maxlength: 2048 },
    host: String,
    protocol: String,

    cfRay: String,
    country: String,

    rule: {
      type: String,
      index: true,
    },

    action: {
      type: String,
      enum: ["404", "403", "destroy"],
      default: "404",
    },

    count: {
      type: Number,
      default: 1,
      index: true,
    },

    firstSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    geo: {
      status: String,
      country: String,
      countryCode: String,
      region: String,
      regionName: String,
      city: String,
      zip: String,
      lat: Number,
      lon: Number,
      timezone: String,
      isp: String,
      org: String,
      as: String,
      source: String,
      error: String,
      fetchedAt: Date,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "bot_block_logs",
    minimize: true,
  }
);

BotBlockLogSchema.index({ ip: 1, lastSeenAt: -1 });
BotBlockLogSchema.index({ path: 1, lastSeenAt: -1 });
BotBlockLogSchema.index({ rule: 1, lastSeenAt: -1 });
BotBlockLogSchema.index({ lastSeenAt: -1 });
BotBlockLogSchema.index({ "geo.countryCode": 1, lastSeenAt: -1 });
BotBlockLogSchema.index({ "geo.city": 1, lastSeenAt: -1 });

// เก็บ log ตาม secure_config.botBlock.logTtlDays
// ค่า default = 30 วัน
BotBlockLogSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: getBotBlockLogTtlSeconds(),
  }
);

export const BotBlockLog =
  mongoose.models.BotBlockLog ||
  mongoose.model("BotBlockLog", BotBlockLogSchema);