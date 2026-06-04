// models/BonustimeUser.js
import mongoose from "mongoose";
import { getBonustimeDb } from "../db/mongoBonustime";

const BonustimeUserSchema = new mongoose.Schema(
  {
    tenantId: String,
    legacyTenantId: String,
    serviceMode: String,
    serviceGroup: String,
    serviceNo: Number,
    serviceKey: { type: String, index: true },
    webhookUrl: String,
    webhookPath: String,
    sharedServiceName: String,
    serial_key: String,
    NAME: String,
    CHANNEL_ACCESS_TOKEN: String,
    CHANNEL_SECRET: String,
    LOGO: String,
    LOGIN_URL: String,
    SIGNUP_URL: String,
    LINE_ADMIN: String,
    ALLOW_TEXT_PROVIDER: Boolean,
    LOTTO_ENABLED: Boolean,
    LICENSE_START_DATE: String,
    LICENSE_DURATION_DAYS: Number,
    LICENSE_DISABLED: Boolean,
    LINK: String,
    expiryNotifySent: Date,
    migratedAt: Date,
    note: String,
  },
  { collection: "users" }
);

const _btDb = getBonustimeDb();
export const BonustimeUser: any = _btDb.models['users'] || _btDb.model("users", BonustimeUserSchema);
