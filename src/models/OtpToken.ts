// models/OtpToken.js
import mongoose from 'mongoose';

const OtpTokenSchema = new mongoose.Schema({
  email: { type: String, index: true, required: true },
  purpose: { type: String, default: 'email-verify' },
  codeHash: { type: String, required: true },
  tokenDigest: { type: String, index: true, default: null },
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  lastSentAt: { type: Date, default: null },
  usedAt: { type: Date, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

OtpTokenSchema.index({ email: 1, purpose: 1 });
OtpTokenSchema.index({ purpose: 1, tokenDigest: 1, usedAt: 1 });

export const OtpToken: any = mongoose.models.OtpToken || mongoose.model('OtpToken', OtpTokenSchema);
