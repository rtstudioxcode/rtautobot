// models/ServiceCache.js
import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: { type: String, unique: true }, // เช่น service-groups:catId
  data: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now }
});

export const ServiceCache =
  mongoose.models.ServiceCache ||
  mongoose.model("ServiceCache", schema);