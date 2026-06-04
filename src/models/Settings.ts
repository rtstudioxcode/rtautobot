// src/models/Settings.js
import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

export const Settings: any =
  mongoose.models.Settings ||
  mongoose.model("Settings", schema);