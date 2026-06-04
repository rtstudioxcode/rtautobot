import mongoose from "mongoose";
import { ulid } from "ulid";

const TransactionSchema = new mongoose.Schema({
  // =========================
  // 👤 USER
  // =========================
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },

  username: { type: String },

  // =========================
  // 💳 METHOD
  // =========================
  method: {
    type: String,
    enum: ["tw", "scb", "kbank", "qr", "manual", "admin"],
    required: true,
    index: true,
  },

  // =========================
  // 🏦 SENDER INFO
  // =========================
  senderBank: String,
  senderLast6: String,
  receiverLast6: String,
  senderNumber: String,

  // =========================
  // 💰 AMOUNT
  // =========================
  amount: {
    type: Number,
    required: true,
    min: 0,
  },

  amountCents: {
    type: Number,
    required: true,
    index: true,
  },

  currency: {
    type: String,
    default: "THB",
  },

  production: {
    type: String,
    default: "rtautobot",
    index: true,
  },

  // =========================
  // 📊 STATUS
  // =========================
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", "cancelled", "reject"],
    default: "pending",
    index: true,
  },

  // =========================
  // 🆔 TRANSACTION ID
  // =========================
  transactionId: {
    type: String,
    unique: true,
    default: () => ulid(),
    index: true,
  },

  // =========================
  // 🧠 MATCH / FLOW
  // =========================
  expectedAmount: Number,
  topupExtraCents: Number,
  expiresAt: Date,
  paidAt: Date,

  matchedBy: String,
  matchedTxId: mongoose.Schema.Types.ObjectId,

  // =========================
  // 🕒 TIMING (สำคัญมาก)
  // =========================
  // เวลา "เงินเข้า" จริงจาก SMS / webhook
  occurredAt: {
    type: Date,
    index: true,
  },

  // =========================
  // 📝 NOTE / DEBUG
  // =========================
  note: String,

  // 🔥 debug / audit (สำคัญมาก)
  rawMessage: String,
  ipAddress: String,

}, {
  timestamps: true, // createdAt / updatedAt (อย่า override)
});


// =========================
// 🔥 INDEX (QUERY หลัก)
// =========================
TransactionSchema.index({
  production: 1,
  method: 1,
  status: 1,
  amountCents: 1,
  createdAt: -1,
});


// =========================
// 🔥 INDEX เพิ่ม (match เร็ว)
// =========================
TransactionSchema.index({
  production: 1,
  method: 1,
  amountCents: 1,
  createdAt: -1,
});


// =========================
// 🔥 กัน double transaction
// =========================
TransactionSchema.index(
  { production: 1, method: 1, amountCents: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
    },
  }
);


// =========================
// ✅ ห้ามใช้ TTL ลบรายการเติมเงิน pending
// =========================
// รายการที่มี userId คือผู้ใช้สร้างจากหน้าเว็บ ต้องค้างไว้ให้ตรวจสอบ/จับคู่ภายหลัง
// RTAUTOBOT: ไม่ใช้ topup reject job แยก รายการเติมเงินจัดการผ่าน flow/admin ของเว็บนี้เท่านั้น


// =========================
// 🔥 INDEX cleanup processing
// =========================
TransactionSchema.index({
  status: 1,
  expiresAt: 1,
});


// =========================
// 🚀 EXPORT
// =========================
export const Transaction: any =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", TransactionSchema);