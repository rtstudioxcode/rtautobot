// src/config.js
import "dotenv/config";
import mongoose from "mongoose";
import crypto from "crypto";
import { decryptAesGcm } from "./lib/crypto.js";

/**
 * ENV เหลือไว้สำหรับ bootstrap / ค่าจำเป็นก่อนต่อ DB เท่านั้น
 *
 * ควรเหลือหลัก ๆ:
 * - MONGO_URI
 * - BONUSTIME_URI
 * - REDIS_URL
 *
 * ค่าอื่นให้ไปอยู่ใน secure_config ทั้งหมด
 */

const toBool = (v, def = false) => {
  if (v === undefined || v === null || v === "") return def;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(s);
};

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const trimBase = (u = "") => String(u || "").replace(/\/+$/, "");
const pickEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
};

const envConfig = {
  /**
   * Bootstrap
   * mongoUri ยังต้องอ่านจาก ENV ก่อน เพราะต้องใช้ต่อ DB เพื่อโหลด secure_config
   */
  port: 3000,
  mongoUri: pickEnv("MONGO_URI", "MONGODB_URI", "DATABASE_URL"),
  // รองรับ Railway Private URL ที่ไม่มีชื่อ DB ต่อท้าย URI
  // ตัวอย่าง: MONGO_URI=${{ MongoDB.MONGO_URL }} + MONGO_DBNAME=rtsmm-th
  mongoDbName: pickEnv(
    "MONGO_DBNAME",
    "MONGO_DB_NAME",
    "MONGODB_DBNAME",
    "MONGODB_DB",
    "MONGO_DB",
    "DB_NAME"
  ),
  sessionSecret: "",

  bonustime: {
    mongoUri: pickEnv("BONUSTIME_URI", "BONUSTIME_MONGODB_URI") || pickEnv("MONGO_URI", "MONGODB_URI", "DATABASE_URL"),
    // Bonustime ใช้ cluster เดียวกับ Mongo หลักได้ แต่แยก DB name
    // ตัวอย่าง: BONUSTIME_URI=${{ MongoDB.MONGO_URL }} + BONUSTIME_DBNAME=rtautobot
    dbName:
      pickEnv(
        "BONUSTIME_DBNAME",
        "BONUSTIME_DB_NAME",
        "BONUSTIME_MONGO_DBNAME",
        "BONUSTIME_MONGO_DB",
        "BONUSTIME_DB"
      ) || "rtautobot",
    webhookBaseUrl: pickEnv("BONUSTIME_WEBHOOK_BASE_URL"),
    sharedServiceName: pickEnv("BONUSTIME_SHARED_SERVICE_NAME"),
  },

  redis: {
    url: process.env.REDIS_URL || "",
  },

  /**
   * iPlusView
   * Doc ใช้ชื่อ ipv แต่ในโค้ด runtime ใช้ config.provider
   */
  provider: {
    baseUrl: "https://api.iplusview.store",
    apiKey: "",
  },

  /**
   * OTP24hr
   * Doc ใช้ชื่อ otp24 แต่ในโค้ด runtime ใช้ config.otp24hr
   */
  otp24hr: {
    apiBase: "https://otp24hr.com/api/v1",
    apiKey: "",
  },

  currency: "THB",
  initialBalance: 0,
  signupBonus: 0,

  mail: {
    host: "smtp.gmail.com",
    port: 587,
    user: "",
    pass: "",
    from: "RTSSM-TH <no-reply@rtsmm-th.com>",
    debug: false,
    secure: false,
  },

  otp: {
    ttlSec: 600,
    resendCooldownSec: 60,
    maxAttempts: 5,
  },

  TW_GEN_LINK_SECRET: "",

  turnstile: {
    siteKey: "",
    secretKey: "",
  },

  system: {
    globalLogEnabled: false,
    tz: "Asia/Bangkok",
    workerConcurrency: 3,
    jwtSecret: "",
    syncIndexes: true,
    // รีโหลด secure_config จาก DB อัตโนมัติแบบไม่ต้อง restart server
    secureConfigAutoReloadEnabled: true,
    secureConfigReloadIntervalMs: 30000,
  },

  brand: {
    url: "https://rtsmm-th.com",
  },

  session: {
    name: "connect.sid",
  },

  jobs: {
    orderStatusTickMs: 60000,
    orderStatusConcurrency: 20,
    orderStatusBatchLimit: 300,
    orderStatusFastScanMs: 2000,
    orderStatusAutoCancelAfterMs: 43200000,
    orderStatusRecentCheckMs: 60000,
    orderStatusWarmCheckMs: 300000,
    orderStatusColdCheckMs: 900000,
    orderStatusTerminalCleanupCheckMs: 1800000,

    otp24SweeperIntervalMs: 10000,
    otp24SweeperBatchLimit: 50,
    otp24SweeperConcurrency: 2,

    // Refresh รายการ /apps getpack ที่ต้นทางยังขึ้น placeholder รอรายละเอียดสินค้า
    otp24AppsRefreshIntervalMs: 15 * 60 * 1000,
    otp24AppsRefreshBatchLimit: 50,

    // Sync รายการสินค้า/stock จาก OTP24 API + refresh ยอดเงิน provider ทุก 12 ชั่วโมง
    otp24ProductsSyncIntervalMs: 12 * 60 * 60 * 1000,
    otp24ProductsSyncApiPerc: 0,
    otp24ProductsSyncAddPerc: 35,
    otp24ImageFetchPerMinute: 12,

    telegramCheckIntervalMs: 60000,
    telegramCheckBatchLimit: 50,

    dailyChangeSyncTelegramSummary: true,
    dailyChangeSyncTelegramTimeoutMs: 10000,
    dailyChangeSyncCron: "0 7 * * *",

    topupRejectCron: "*/5 * * * *",
    topupRejectBatchSize: 50,
    topupRejectAgeMinutes: 1,
    topupRejectAgeHours: 12,

    bonustimeExpiryCron: "*/5 * * * *",
    bonustimeExpiryBatchSize: 100,
  },

  botBlock: {
    // Master switch: Cloudflare should handle scanner/bot blocking in production.
    // Keep this false to avoid Railway/Node/Mongo doing DB work for scanner noise.
    enabled: false,
    logEnabled: false,
    action: 404,
    aggWindowMs: 300000,
    consoleSampleMs: 30000,
    logTtlDays: 30,

    geoipEnabled: true,
    geoipTimeoutMs: 900,
    geoipCacheDays: 30,

    ipBanEnabled: true,
    ipBanThreshold: 2,
    ipBanWindowMs: 86400000,
    ipBanCacheMs: 300000,
    banStatus: 403,
    ipBanDays: 1,
  },

  // Client-side source hardening / DevTools nuisance layer
  // ตั้ง false ใน secure_config.security เพื่อปิดชั่วคราวตอน debug ได้
  security: {
    clientSourceProtectionEnabled: true,
    inlineScriptObfuscationEnabled: true,
    publicJsObfuscationEnabled: true,
    serviceWorkerObfuscationEnabled: true,
    inlineCssMinifyEnabled: true,
    publicCssMinifyEnabled: true,
  },

  railway: {
    apiToken: "",
    projectId: "",
  },

  telegram: {
    botToken: "",
    channelId: "",
  },
};

// live object ที่ทุกไฟล์ใช้ร่วมกัน
export const config = structuredClone(envConfig);

/* ================= DB-backed secure config ================ */

const secureConfigSchema = new mongoose.Schema(
  {
    port: Number,
    sessionSecret: String,
    mongoDbName: String,

    bonustime: {
      mongoUri: String,
      dbName: String,
      webhookBaseUrl: String,
      sharedServiceName: String,
    },

    ipv: {
      apiBase: String,
      apiKey: String,
    },

    // รองรับทั้งชื่อใหม่ otp24hr และชื่อใน Doc ปัจจุบัน otp24
    otp24hr: {
      apiBase: String,
      apiKey: String,
    },

    otp24: {
      apiBase: String,
      apiKey: String,
    },

    mail: {
      host: String,
      port: Number,
      user: String,
      pass: String,
      from: String,
      debug: mongoose.Schema.Types.Mixed,
      secure: mongoose.Schema.Types.Mixed,
    },

    otp: {
      ttlSec: Number,
      resendCooldownSec: Number,
      maxAttempts: Number,
    },

    TW_GEN_LINK_SECRET: String,

    turnstile: {
      siteKey: String,
      secretKey: String,
    },

    system: {
      globalLogEnabled: mongoose.Schema.Types.Mixed,
      tz: String,
      workerConcurrency: Number,
      jwtSecret: String,
      syncIndexes: mongoose.Schema.Types.Mixed,
      secureConfigAutoReloadEnabled: mongoose.Schema.Types.Mixed,
      secureConfigReloadIntervalMs: Number,
    },

    jobs: {
      orderStatusTickMs: Number,
      orderStatusConcurrency: Number,
      orderStatusBatchLimit: Number,
      orderStatusFastScanMs: Number,
      orderStatusAutoCancelAfterMs: Number,
      orderStatusRecentCheckMs: Number,
      orderStatusWarmCheckMs: Number,
      orderStatusColdCheckMs: Number,
      orderStatusTerminalCleanupCheckMs: Number,

      otp24SweeperIntervalMs: Number,
      otp24SweeperBatchLimit: Number,
      otp24SweeperConcurrency: Number,

      otp24AppsRefreshIntervalMs: Number,
      otp24AppsRefreshBatchLimit: Number,
      otp24ProductsSyncIntervalMs: Number,
      otp24ProductsSyncApiPerc: Number,
      otp24ProductsSyncAddPerc: Number,
      otp24ImageFetchPerMinute: Number,

      telegramCheckIntervalMs: Number,
      telegramCheckBatchLimit: Number,

      dailyChangeSyncTelegramSummary: mongoose.Schema.Types.Mixed,
      dailyChangeSyncTelegramTimeoutMs: Number,
      dailyChangeSyncCron: String,

      topupRejectCron: String,
      topupRejectBatchSize: Number,
      topupRejectAgeMinutes: Number,
      topupRejectAgeHours: Number,

      bonustimeExpiryCron: String,
      bonustimeExpiryBatchSize: Number,
    },

    botBlock: {
      enabled: mongoose.Schema.Types.Mixed,
      logEnabled: mongoose.Schema.Types.Mixed,
      action: Number,
      aggWindowMs: Number,
      consoleSampleMs: Number,
      logTtlDays: Number,

      geoipEnabled: mongoose.Schema.Types.Mixed,
      geoipTimeoutMs: Number,
      geoipCacheDays: Number,

      ipBanEnabled: mongoose.Schema.Types.Mixed,
      ipBanThreshold: Number,
      ipBanWindowMs: Number,
      ipBanCacheMs: Number,
      banStatus: Number,
      ipBanDays: Number,
    },

    security: {
      clientSourceProtectionEnabled: mongoose.Schema.Types.Mixed,
      inlineScriptObfuscationEnabled: mongoose.Schema.Types.Mixed,
      publicJsObfuscationEnabled: mongoose.Schema.Types.Mixed,
      serviceWorkerObfuscationEnabled: mongoose.Schema.Types.Mixed,
      inlineCssMinifyEnabled: mongoose.Schema.Types.Mixed,
      publicCssMinifyEnabled: mongoose.Schema.Types.Mixed,
    },

    railway: {
      apiToken: String,
      projectId: String,
    },

    telegram: {
      botToken: String,
      channelId: String,
    },

    brand: {
      url: String,
    },

    session: {
      name: String,
    },

    // เก็บ mongoUri แบบเข้ารหัส ถ้าอนาคตอยากย้าย MONGO_URI เข้า DB
    mongoUriEnc: String,
  },
  {
    collection: "secure_config",
    minimize: true,
    strict: false,
  }
);

const SecureConfig =
  mongoose.models.SecureConfig ||
  mongoose.model("SecureConfig", secureConfigSchema);

function setIfString(target, key, value) {
  if (value === undefined || value === null) return;
  const s = String(value).trim();
  if (s) target[key] = s;
}

function setIfNumber(target, key, value) {
  if (value === undefined || value === null || value === "") return;
  const n = Number(value);
  if (Number.isFinite(n)) target[key] = n;
}

function setIfBool(target, key, value) {
  if (value === undefined || value === null || value === "") return;
  target[key] = toBool(value, target[key]);
}

/**
 * รวมค่าแบบ DB > default
 * ยกเว้น MONGO_URI / BONUSTIME_URI / REDIS_URL ยังให้ ENV เป็น bootstrap หลัก
 */
function applyDBToConfig(doc) {
  if (!doc) return;

  /**
   * ถอดรหัส mongoUri ถ้ามี
   * หมายเหตุ: CONFIG_KEY ยังต้องอยู่ใน ENV ถ้าใช้ mongoUriEnc
   */
  if (!process.env.CONFIG_KEY) {
    console.warn('[SECURITY WARNING] CONFIG_KEY not set — secure config stored unencrypted in MongoDB');
  }

  if (doc.mongoUriEnc) {
    const key = process.env.CONFIG_KEY || "";
    try {
      const dec = decryptAesGcm(doc.mongoUriEnc, key);
      if (dec) config.mongoUriFromDBDecrypted = dec;
    } catch {}
  }

  /**
   * Root
   */
  setIfNumber(config, "port", doc.port);
  setIfString(config, "sessionSecret", doc.sessionSecret);
  setIfString(config, "TW_GEN_LINK_SECRET", doc.TW_GEN_LINK_SECRET);
  setIfString(config, "mongoDbName", doc.mongoDbName);

  if (doc.bonustime) {
    setIfString(config.bonustime, "mongoUri", doc.bonustime.mongoUri);
    setIfString(config.bonustime, "dbName", doc.bonustime.dbName);
    setIfString(config.bonustime, "webhookBaseUrl", doc.bonustime.webhookBaseUrl);
    setIfString(config.bonustime, "sharedServiceName", doc.bonustime.sharedServiceName);
  }

  /**
   * iPlusView
   * DB Doc = ipv
   * Runtime = config.provider
   */
  if (doc.ipv) {
    const baseIpv = trimBase(doc.ipv.apiBase || "");
    const keyIpv = String(doc.ipv.apiKey || "").trim();

    if (baseIpv) config.provider.baseUrl = baseIpv;
    if (keyIpv) config.provider.apiKey = keyIpv;
  }

  /**
   * OTP24hr
   * รองรับทั้ง doc.otp24hr และ doc.otp24
   */
  const otp24doc = doc.otp24hr || doc.otp24 || null;

  if (otp24doc) {
    const baseOtp24 = trimBase(otp24doc.apiBase || "");
    const keyOtp24 = String(otp24doc.apiKey || "").trim();

    if (baseOtp24) config.otp24hr.apiBase = baseOtp24;
    if (keyOtp24) config.otp24hr.apiKey = keyOtp24;
  }

  /**
   * Mail
   */
  if (doc.mail) {
    setIfString(config.mail, "host", doc.mail.host);
    setIfNumber(config.mail, "port", doc.mail.port);
    setIfString(config.mail, "user", doc.mail.user);
    setIfString(config.mail, "pass", doc.mail.pass);
    setIfString(config.mail, "from", doc.mail.from);
    setIfBool(config.mail, "debug", doc.mail.debug);
    setIfBool(config.mail, "secure", doc.mail.secure);
  }

  /**
   * OTP policy
   */
  if (doc.otp) {
    setIfNumber(config.otp, "ttlSec", doc.otp.ttlSec);
    setIfNumber(
      config.otp,
      "resendCooldownSec",
      doc.otp.resendCooldownSec
    );
    setIfNumber(config.otp, "maxAttempts", doc.otp.maxAttempts);
  }

  /**
   * Turnstile
   */
  if (doc.turnstile) {
    setIfString(config.turnstile, "siteKey", doc.turnstile.siteKey);
    setIfString(config.turnstile, "secretKey", doc.turnstile.secretKey);
  }

  /**
   * System
   */
  if (doc.system) {
    setIfBool(
      config.system,
      "globalLogEnabled",
      doc.system.globalLogEnabled
    );

    setIfString(config.system, "tz", doc.system.tz);

    setIfNumber(
      config.system,
      "workerConcurrency",
      doc.system.workerConcurrency
    );

    setIfString(config.system, "jwtSecret", doc.system.jwtSecret);

    setIfBool(config.system, "syncIndexes", doc.system.syncIndexes);
    setIfBool(
      config.system,
      "secureConfigAutoReloadEnabled",
      doc.system.secureConfigAutoReloadEnabled
    );
    setIfNumber(
      config.system,
      "secureConfigReloadIntervalMs",
      doc.system.secureConfigReloadIntervalMs
    );
  }

  /**
   * Jobs
   */
  if (doc.jobs) {
    setIfNumber(config.jobs, "orderStatusTickMs", doc.jobs.orderStatusTickMs);
    setIfNumber(
      config.jobs,
      "orderStatusConcurrency",
      doc.jobs.orderStatusConcurrency
    );
    setIfNumber(
      config.jobs,
      "orderStatusBatchLimit",
      doc.jobs.orderStatusBatchLimit
    );
    setIfNumber(
      config.jobs,
      "orderStatusFastScanMs",
      doc.jobs.orderStatusFastScanMs
    );
    setIfNumber(
      config.jobs,
      "orderStatusAutoCancelAfterMs",
      doc.jobs.orderStatusAutoCancelAfterMs
    );

    setIfNumber(config.jobs, "orderStatusRecentCheckMs", doc.jobs.orderStatusRecentCheckMs);
    setIfNumber(config.jobs, "orderStatusWarmCheckMs", doc.jobs.orderStatusWarmCheckMs);
    setIfNumber(config.jobs, "orderStatusColdCheckMs", doc.jobs.orderStatusColdCheckMs);
    setIfNumber(config.jobs, "orderStatusTerminalCleanupCheckMs", doc.jobs.orderStatusTerminalCleanupCheckMs);

    setIfNumber(
      config.jobs,
      "otp24SweeperIntervalMs",
      doc.jobs.otp24SweeperIntervalMs
    );
    setIfNumber(
      config.jobs,
      "otp24SweeperBatchLimit",
      doc.jobs.otp24SweeperBatchLimit
    );
    setIfNumber(
      config.jobs,
      "otp24SweeperConcurrency",
      doc.jobs.otp24SweeperConcurrency
    );
    setIfNumber(
      config.jobs,
      "otp24AppsRefreshIntervalMs",
      doc.jobs.otp24AppsRefreshIntervalMs
    );
    setIfNumber(
      config.jobs,
      "otp24AppsRefreshBatchLimit",
      doc.jobs.otp24AppsRefreshBatchLimit
    );
    setIfNumber(
      config.jobs,
      "otp24ProductsSyncIntervalMs",
      doc.jobs.otp24ProductsSyncIntervalMs
    );
    setIfNumber(
      config.jobs,
      "otp24ProductsSyncApiPerc",
      doc.jobs.otp24ProductsSyncApiPerc
    );
    setIfNumber(
      config.jobs,
      "otp24ProductsSyncAddPerc",
      doc.jobs.otp24ProductsSyncAddPerc
    );
    setIfNumber(
      config.jobs,
      "otp24ImageFetchPerMinute",
      doc.jobs.otp24ImageFetchPerMinute
    );

    setIfNumber(
      config.jobs,
      "telegramCheckIntervalMs",
      doc.jobs.telegramCheckIntervalMs
    );
    setIfNumber(
      config.jobs,
      "telegramCheckBatchLimit",
      doc.jobs.telegramCheckBatchLimit
    );

    setIfBool(
      config.jobs,
      "dailyChangeSyncTelegramSummary",
      doc.jobs.dailyChangeSyncTelegramSummary
    );
    setIfNumber(
      config.jobs,
      "dailyChangeSyncTelegramTimeoutMs",
      doc.jobs.dailyChangeSyncTelegramTimeoutMs
    );
    setIfString(
      config.jobs,
      "dailyChangeSyncCron",
      doc.jobs.dailyChangeSyncCron
    );

    setIfString(config.jobs, "topupRejectCron", doc.jobs.topupRejectCron);
    setIfNumber(
      config.jobs,
      "topupRejectBatchSize",
      doc.jobs.topupRejectBatchSize
    );
    setIfNumber(
      config.jobs,
      "topupRejectAgeMinutes",
      doc.jobs.topupRejectAgeMinutes
    );
    setIfNumber(
      config.jobs,
      "topupRejectAgeHours",
      doc.jobs.topupRejectAgeHours
    );

    setIfString(
      config.jobs,
      "bonustimeExpiryCron",
      doc.jobs.bonustimeExpiryCron
    );
    setIfNumber(
      config.jobs,
      "bonustimeExpiryBatchSize",
      doc.jobs.bonustimeExpiryBatchSize
    );
  }

  /**
   * Bot Block
   */
  if (doc.botBlock) {
    setIfBool(config.botBlock, "enabled", doc.botBlock.enabled);
    setIfBool(config.botBlock, "logEnabled", doc.botBlock.logEnabled);
    setIfNumber(config.botBlock, "action", doc.botBlock.action);
    setIfNumber(config.botBlock, "aggWindowMs", doc.botBlock.aggWindowMs);
    setIfNumber(
      config.botBlock,
      "consoleSampleMs",
      doc.botBlock.consoleSampleMs
    );
    setIfNumber(config.botBlock, "logTtlDays", doc.botBlock.logTtlDays);

    setIfBool(config.botBlock, "geoipEnabled", doc.botBlock.geoipEnabled);
    setIfNumber(config.botBlock, "geoipTimeoutMs", doc.botBlock.geoipTimeoutMs);
    setIfNumber(config.botBlock, "geoipCacheDays", doc.botBlock.geoipCacheDays);

    setIfBool(config.botBlock, "ipBanEnabled", doc.botBlock.ipBanEnabled);
    setIfNumber(config.botBlock, "ipBanThreshold", doc.botBlock.ipBanThreshold);
    setIfNumber(config.botBlock, "ipBanWindowMs", doc.botBlock.ipBanWindowMs);
    setIfNumber(config.botBlock, "ipBanCacheMs", doc.botBlock.ipBanCacheMs);
    setIfNumber(config.botBlock, "banStatus", doc.botBlock.banStatus);
    setIfNumber(config.botBlock, "ipBanDays", doc.botBlock.ipBanDays);
  }

  /**
   * Client source protection / DevTools hardening
   */
  if (doc.security) {
    setIfBool(
      config.security,
      "clientSourceProtectionEnabled",
      doc.security.clientSourceProtectionEnabled
    );
    setIfBool(
      config.security,
      "inlineScriptObfuscationEnabled",
      doc.security.inlineScriptObfuscationEnabled
    );
    setIfBool(
      config.security,
      "publicJsObfuscationEnabled",
      doc.security.publicJsObfuscationEnabled
    );
    setIfBool(
      config.security,
      "serviceWorkerObfuscationEnabled",
      doc.security.serviceWorkerObfuscationEnabled
    );
    setIfBool(
      config.security,
      "inlineCssMinifyEnabled",
      doc.security.inlineCssMinifyEnabled
    );
    setIfBool(
      config.security,
      "publicCssMinifyEnabled",
      doc.security.publicCssMinifyEnabled
    );
  }

  /**
   * Railway
   */
  if (doc.railway) {
    setIfString(config.railway, "apiToken", doc.railway.apiToken);
    setIfString(config.railway, "projectId", doc.railway.projectId);
  }

  /**
   * Telegram
   */
  if (doc.telegram) {
    setIfString(config.telegram, "botToken", doc.telegram.botToken);
    setIfString(config.telegram, "channelId", doc.telegram.channelId);
  }

  /**
   * Brand
   */
  if (doc.brand) {
    const brandUrl = trimBase(doc.brand.url || "");
    if (brandUrl) config.brand.url = brandUrl;
  }

  /**
   * Session
   */
  if (doc.session) {
    setIfString(config.session, "name", doc.session.name);
  }

  /**
   * tidy
   */
  config.provider.baseUrl = trimBase(config.provider.baseUrl);
  config.otp24hr.apiBase = trimBase(config.otp24hr.apiBase);
  config.brand.url = trimBase(config.brand.url);
}

/**
 * เรียกหลังจาก connect Mongo เรียบร้อย
 * ดึงค่าจาก DB และอัปเดต config live object
 */
function resetConfigToDefaults() {
  const fresh = structuredClone(envConfig);
  const decryptedMongoUri = config.mongoUriFromDBDecrypted;

  for (const key of Object.keys(config)) {
    delete config[key];
  }
  Object.assign(config, fresh);

  if (decryptedMongoUri) {
    config.mongoUriFromDBDecrypted = decryptedMongoUri;
  }
}

function stableConfigHash(doc) {
  if (!doc) return "no-doc";
  const clean = structuredClone(doc);
  delete clean.__v;
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(clean))
    .digest("hex");
}

let lastSecureConfigHash = "";
let secureConfigReloadTimer = null;
let secureConfigReloadInFlight = false;

export async function refreshConfigFromDB({ markHash = true } = {}) {
  try {
    const doc = await SecureConfig.findOne().lean();

    // สำคัญ: รีเซ็ตกลับ default ก่อน apply DB เพื่อให้การลบ/ปิดค่าใน secure_config มีผลจริง
    resetConfigToDefaults();
    applyDBToConfig(doc || null);

    if (markHash) {
      lastSecureConfigHash = stableConfigHash(doc || null);
    }

    /**
     * sync timezone ให้ process ด้วย
     * มีผลกับ lib/date/cron บางตัวที่อ่าน process.env.TZ
     */
    if (config.system?.tz) {
      process.env.TZ = config.system.tz;
    }

    return config;
  } catch {
    return config;
  }
}

export function startSecureConfigAutoReload({ onReload } = {}) {
  if (secureConfigReloadTimer) return secureConfigReloadTimer;

  const tick = async () => {
    if (secureConfigReloadInFlight) return;
    if (config.system?.secureConfigAutoReloadEnabled === false) return;

    secureConfigReloadInFlight = true;
    try {
      const doc = await SecureConfig.findOne().lean();
      const nextHash = stableConfigHash(doc || null);

      if (!lastSecureConfigHash) {
        lastSecureConfigHash = nextHash;
        return;
      }

      if (nextHash !== lastSecureConfigHash) {
        lastSecureConfigHash = nextHash;
        await refreshConfigFromDB({ markHash: false });
        try {
          onReload?.(config);
        } catch {}
      }
    } catch {
      // เงียบไว้เพื่อไม่ให้ polling ทำให้ server log แตก
    } finally {
      secureConfigReloadInFlight = false;
    }
  };

  const interval = Math.max(10000, Number(config.system?.secureConfigReloadIntervalMs || 30000));
  secureConfigReloadTimer = setInterval(tick, interval);
  secureConfigReloadTimer.unref?.();
  return secureConfigReloadTimer;
}

export function stopSecureConfigAutoReload() {
  if (secureConfigReloadTimer) {
    clearInterval(secureConfigReloadTimer);
    secureConfigReloadTimer = null;
  }
}

/**
 * utility: อ่านเอกสารเต็ม
 * ใช้กับ debug / หน้า settings แอดมิน
 */
export async function getSecureConfigDoc() {
  try {
    return await SecureConfig.findOne().lean();
  } catch {
    return null;
  }
}

/* ================= Utilities สำหรับเชื่อม Mongo ================= */

/**
 * เลือก URI ที่จะใช้เชื่อม
 * ลำดับ:
 * 1. mongoUri ที่ถอดรหัสจาก DB
 * 2. MONGO_URI จาก ENV
 * 3. config.mongoUri
 */
export function resolveMongoUri() {
  return (
    config.mongoUriFromDBDecrypted ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    config.mongoUri
  );
}

export function resolveMongoDbName() {
  return (
    pickEnv(
      "MONGO_DBNAME",
      "MONGO_DB_NAME",
      "MONGODB_DBNAME",
      "MONGODB_DB",
      "MONGO_DB",
      "DB_NAME"
    ) ||
    config.mongoDbName ||
    ""
  );
}

export function resolveBonustimeUri() {
  return (
    process.env.BONUSTIME_URI ||
    config?.bonustime?.mongoUri ||
    resolveMongoUri()
  );
}

export function resolveBonustimeDbName() {
  return (
    pickEnv(
      "BONUSTIME_DBNAME",
      "BONUSTIME_DB_NAME",
      "BONUSTIME_MONGO_DBNAME",
      "BONUSTIME_MONGO_DB",
      "BONUSTIME_DB"
    ) ||
    config?.bonustime?.dbName ||
    "rtautobot"
  );
}

/**
 * ต่อ MongoDB ถ้ายังไม่ต่อ หรือหลุดไปแล้ว
 */
export async function connectMongoIfNeeded() {
  const st = mongoose.connection.readyState;
  if (st === 1 || st === 2) return mongoose.connection;

  const uri = resolveMongoUri();
  if (!uri) throw new Error("MONGO_URI is missing (env/secure_config)");

  const dbName = resolveMongoDbName();
  await mongoose.connect(uri, dbName ? { dbName } : {});
  return mongoose.connection;
}