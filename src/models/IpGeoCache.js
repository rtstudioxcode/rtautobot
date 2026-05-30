// src/models/IpGeoCache.js
import mongoose from "mongoose";
import { config } from "../config.js";

function getGeoIpCacheExpireDate() {
  const days = Number(config?.botBlock?.geoipCacheDays ?? 30);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 30;

  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}

const IpGeoCacheSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
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

    hitCount: {
      type: Number,
      default: 1,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    expiresAt: {
      type: Date,
      default: getGeoIpCacheExpireDate,
    },
  },
  {
    collection: "ip_geo_cache",
    minimize: true,
  }
);

IpGeoCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IpGeoCache =
  mongoose.models.IpGeoCache ||
  mongoose.model("IpGeoCache", IpGeoCacheSchema);