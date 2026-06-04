// src/models/MacroDroidInbox.js
// Raw inbox สำหรับรับข้อความแจ้งเตือนจาก MacroDroid ก่อนนำไป match กับสลิป/รายการเติมเงิน
import mongoose from "mongoose";

const macroDroidInboxSchema = new mongoose.Schema(
  {
    source: { type: String, default: "macrodroid", index: true },
    channel: { type: String, default: "notification", index: true },

    deviceId: { type: String, default: "", index: true },
    bank: { type: String, default: "", index: true },
    appPackage: { type: String, default: "" },
    appName: { type: String, default: "" },

    title: { type: String, default: "" },
    text: { type: String, default: "" },
    bigText: { type: String, default: "" },
    rawText: { type: String, default: "" },

    amount: { type: Number, default: null, index: true },
    currency: { type: String, default: "THB" },
    accountLast4: { type: String, default: "" },
    transactionRef: { type: String, default: "", index: true },

    notificationAt: { type: Date, default: null, index: true },
    receivedAt: { type: Date, default: Date.now, index: true },

    eventHash: { type: String, required: true, unique: true, index: true },
    duplicateCount: { type: Number, default: 0 },
    lastDuplicateAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ["new", "matched", "ignored", "used"],
      default: "new",
      index: true,
    },
    matchedTopup: { type: mongoose.Schema.Types.ObjectId, ref: "Topup", default: null, index: true },
    usedAt: { type: Date, default: null },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "macrodroid_inbox",
  }
);

macroDroidInboxSchema.index({ receivedAt: -1 });
macroDroidInboxSchema.index({ bank: 1, amount: 1, receivedAt: -1, status: 1 });
macroDroidInboxSchema.index({ transactionRef: 1, status: 1 });

export const MacroDroidInbox: any =
  mongoose.models.MacroDroidInbox ||
  mongoose.model("MacroDroidInbox", macroDroidInboxSchema);
