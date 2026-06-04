import mongoose from "mongoose";

const TopupSchema = new mongoose.Schema(
  {
    accountCode: { type: String, required: true },
    accountName: { type: String },
    accountNumber: { type: String },
    isActive: { type: Boolean, default: true },
    isSMS: { type: Boolean, default: false },
    isAuto: { type: Boolean, default: false },
    secret: { type: String },
    type: { type: String },
    production: { type: String, default: "rtautobot", index: true },
  },
  { timestamps: true }
);

export const Topup: any =
  mongoose.models.Topup || mongoose.model("Topup", TopupSchema);
