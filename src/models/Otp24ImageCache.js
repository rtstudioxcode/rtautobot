// src/models/Otp24ImageCache.js
import mongoose from 'mongoose';

const Otp24ImageCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  sourceUrl: { type: String, required: true },
  contentType: { type: String, default: 'image/png' },
  size: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'otp24imagecaches' });

Otp24ImageCacheSchema.index({ updatedAt: -1 });

export const Otp24ImageCache =
  mongoose.models.Otp24ImageCache ||
  mongoose.model('Otp24ImageCache', Otp24ImageCacheSchema);
