// src/models/BotBlockedIp.js
import mongoose from "mongoose";

const BotBlockedIpSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    reason: {
      type: String,
      default: "bot_scanner_threshold",
      index: true,
    },

    rule: {
      type: String,
      default: "",
      index: true,
    },

    samplePath: {
      type: String,
      default: "",
    },

    sampleUserAgent: {
      type: String,
      default: "",
    },

    hitCountAtBan: {
      type: Number,
      default: 0,
    },

    totalBlockedHits: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "released"],
      default: "active",
      index: true,
    },

    bannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lastHitAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    releasedAt: Date,
    releasedBy: String,
    releaseNote: String,

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
  },
  {
    collection: "bot_blocked_ips",
    timestamps: true,
  }
);

BotBlockedIpSchema.index({ status: 1, lastHitAt: -1 });
BotBlockedIpSchema.index({ status: 1, bannedAt: -1 });
BotBlockedIpSchema.index({ "geo.countryCode": 1, status: 1 });

export const BotBlockedIp =
  mongoose.models.BotBlockedIp ||
  mongoose.model("BotBlockedIp", BotBlockedIpSchema);