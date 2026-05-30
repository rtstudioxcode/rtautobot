import { Router } from "express";
import mongoose from 'mongoose';
import { User } from "../models/User.js";
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getBalance } from "../lib/iplusviewAdapter.js";
import { syncServicesFromProvider } from "../lib/syncServices.js";
import { ProviderSettings } from "../models/ProviderSettings.js";
import { Order } from "../models/Order.js";
import { Transaction } from "../models/Transaction.js";
import { Topup } from "../models/Topup.js";
import { ulid } from "ulid";
import { Service } from '../models/Service.js';
import { getOtp24Balance, getOtp24Products } from '../lib/otp24Adapter.js';
import { Otp24Setting } from '../models/Otp24Setting.js';
import { Otp24Product } from "../models/Otp24Product.js";
import { Otp24Order } from '../models/Otp24Order.js';
import { Otp24AppsOrder } from '../models/Otp24AppsOrder.js';
import { BonustimeOrder } from "../models/BonustimeOrder.js";
import { config, connectMongoIfNeeded, refreshConfigFromDB, resolveBonustimeDbName } from "../config.js";
import { BotBlockLog } from "../models/BotBlockLog.js";
import { BotBlockedIp } from "../models/BotBlockedIp.js";
import { clearIpCache } from "../middleware/botBlocker.js";
import { compactOtp24ProductRaw, syncOtp24ProductsAndBalance } from "../services/otp24ProductsSync.js";
import { getNextServiceIdentity, buildAdditiveFields, publicTenantKey, makeWebhookUrl } from "../services/bonustimeMultiTenant.js";

const router = Router();

const OTP_ONLY_ORDER_FILTER = {
  $or: [
    { productKind: { $exists: false } },
    { productKind: 'otp' },
    { productKind: null },
  ],
};

const ADMIN_SOLD_EXCLUDE_STATUSES = ['canceled', 'cancelled', 'processing', 'failed', 'refunded', 'rejected'];
const ADMIN_SERVICE_META = {
  smm: { key: 'smm', label: 'SMM', title: 'Social Marketing', icon: '📣' },
  otp24: { key: 'otp24', label: 'OTP24', title: 'OTP Rental', icon: '🔐' },
  apps: { key: 'apps', label: 'Apps', title: 'Premium Apps', icon: '📱' },
};
const nz = (v) => Number.isFinite(+v) ? +v : 0;
const round2 = (n) => Math.round((nz(n) + Number.EPSILON) * 100) / 100;

async function getAdminSalesOverview() {
  const [smmAgg, otpAgg, appsAgg] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $nin: ADMIN_SOLD_EXCLUDE_STATUSES } } },
      { $group: { _id: null, count: { $sum: 1 }, sale: { $sum: { $ifNull: ['$cost', '$estCost'] } } } },
    ]),
    Otp24Order.aggregate([
      { $match: { status: /^success$/i, ...OTP_ONLY_ORDER_FILTER } },
      { $group: { _id: null, count: { $sum: 1 }, sale: { $sum: '$salePrice' } } },
    ]),
    Otp24AppsOrder.aggregate([
      { $match: { status: /^success$/i } },
      { $group: { _id: null, count: { $sum: 1 }, sale: { $sum: '$salePrice' } } },
    ]),
  ]);

  const raw = {
    smm: smmAgg?.[0] || { count: 0, sale: 0 },
    otp24: otpAgg?.[0] || { count: 0, sale: 0 },
    apps: appsAgg?.[0] || { count: 0, sale: 0 },
  };
  const totalCount = Object.values(raw).reduce((sum, x) => sum + nz(x.count), 0);
  const totalSale = round2(Object.values(raw).reduce((sum, x) => sum + nz(x.sale), 0));
  const maxSale = Math.max(1, ...Object.values(raw).map(x => nz(x.sale)));
  const maxCount = Math.max(1, ...Object.values(raw).map(x => nz(x.count)));
  const serviceBreakdown = Object.entries(ADMIN_SERVICE_META).map(([key, meta]) => ({
    ...meta,
    count: nz(raw[key]?.count),
    sale: round2(raw[key]?.sale),
    salePct: totalSale > 0 ? Math.round((nz(raw[key]?.sale) / totalSale) * 1000) / 10 : 0,
    countPct: totalCount > 0 ? Math.round((nz(raw[key]?.count) / totalCount) * 1000) / 10 : 0,
    saleBar: Math.round((nz(raw[key]?.sale) / maxSale) * 1000) / 10,
    countBar: Math.round((nz(raw[key]?.count) / maxCount) * 1000) / 10,
  }));

  return {
    totalCount,
    totalSale,
    serviceBreakdown,
    orderCount: nz(raw.smm.count),
    otp24SuccessCount: nz(raw.otp24.count),
    appsSuccessCount: nz(raw.apps.count),
  };
}
router.use(requireAuth);

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

const USER_FIELDS = 'username email avatarUrl avatarVer';

// กันซิงก์ซ้อน
let SYNC_LOCK = false;
let SYNC_STARTED_AT = 0;
const MAX_RUN_MS = 15 * 60 * 1000; // 15 นาที


// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => {
  return config?.system?.globalLogEnabled === true;
};

const glog = {
  log: (...args) => {
    if (isGlobalLogEnabled()) console.log(...args);
  },
  info: (...args) => {
    if (isGlobalLogEnabled()) console.info(...args);
  },
  warn: (...args) => {
    if (isGlobalLogEnabled()) console.warn(...args);
  },
  error: (...args) => {
    if (isGlobalLogEnabled()) console.error(...args);
  },
};

export const isDevUser = async (req) => {
  const userId =
    req.session?.user?._id ||
    req.user?._id;

  if (!userId) return false;

  try {
    const user = await User.findById(userId).select("dev role").lean();

    const isDev =
      user?.dev === true ||
      user?.dev === "true" ||
      user?.dev === 1 ||
      user?.dev === "1";

    const isAdmin = String(user?.role || "").toLowerCase() === "admin";

    return !!(isDev || isAdmin);
  } catch (err) {
    glog.error("[isDevUser] failed to load user", err);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// BONUSTIME helpers — ใช้ connection เดิมของ mongoose แล้วสลับ db เป็น rtautobot
// ─────────────────────────────────────────────────────────────
async function getBonustimeUsersCollection() {
  // ใช้ connectMongoIfNeeded ให้แน่ใจว่า cluster ต่อแล้ว
  await connectMongoIfNeeded();

  const conn = mongoose.connection;
  const client =
    typeof conn.getClient === "function"
      ? conn.getClient()
      : conn.client;

  if (!client) {
    throw new Error("Mongo client is not ready for Bonustime");
  }

  const dbName = resolveBonustimeDbName();
  const db = client.db(dbName);
  return db.collection("users");
}

/**
 * แปลง date/สตริง => label ภาษาไทย เช่น 1 ม.ค. 2568
 */
function fmtDateLabel(value) {
  if (!value) return null;

  let d;
  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value);
    // รองรับฟอร์แมต dd/MM/yyyy (พ.ศ.)
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const yearBE = Number(m[3]);
      const year = yearBE > 2400 ? yearBE - 543 : yearBE;
      d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    } else {
      d = new Date(s);
    }
  }

  if (!Number.isFinite(d.getTime())) return null;

  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/**
 * คำนวณวันหมดอายุจาก LICENSE_START_DATE + LICENSE_DURATION_DAYS
 * คืน { expiresAt, label, input }
 */
function computeLicenseExpiry(doc = {}) {
  if (doc.LICENSE_DISABLED === true) {
    return {
      expiresAt: null,
      label: "ไม่มีวันหมดอายุ",
      input: "",
      disabled: true,
    };
  }

  const startStr = doc.LICENSE_START_DATE;
  const durDays = Number(doc.LICENSE_DURATION_DAYS || 0);
  if (!startStr || !durDays) {
    return { expiresAt: null, label: null, input: "", disabled: false };
  }

  const m = String(startStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    return { expiresAt: null, label: null, input: "", disabled: false };
  }

  const day = Number(m[1]);
  const month = Number(m[2]);
  const yearBE = Number(m[3]);
  const year = yearBE > 2400 ? yearBE - 543 : yearBE;

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (!Number.isFinite(start.getTime())) {
    return { expiresAt: null, label: null, input: "", disabled: false };
  }

  const expires = new Date(start.getTime() + durDays * 24 * 60 * 60 * 1000);
  const label = expires.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const input = expires.toISOString().slice(0, 10); // YYYY-MM-DD

  return { expiresAt: expires, label, input, disabled: false };
}

// === helper : normalize + validate ===
function normDigits(s = "") {
  return String(s).replace(/[^\d]/g, "");
}
function normalizeAndValidateAccount(row) {
  const code = String(row.accountCode || row.code || "").trim();
  const numberRaw = String(row.accountNumber || row.number || "").trim();
  const name = String(row.accountName || row.name || "").trim();
  const digits = normDigits(numberRaw);

  if (!code || !digits || !name)
    return { ok: false, error: "ข้อมูลบัญชีไม่ครบ" };
  if (code === "tw") {
    if (!/^0\d{9}$/.test(digits))
      return { ok: false, error: "TrueWallet ต้องเป็นเบอร์ 10 หลักขึ้นต้น 0" };
  } else {
    if (!/^\d{10,15}$/.test(digits))
      return { ok: false, error: "เลขบัญชีธนาคารต้องยาว 10–15 หลัก" };
  }
  return { ok: true, code, number: digits, name };
}

// Dashboard helpers — เดือนล่าสุดอิงเวลาไทยเสมอ
function getBangkokNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function getBangkokMonthRange(yy, mm) {
  // mm = 1..12 | 00:00 น. ที่ไทย = UTC -7 ชั่วโมง
  const start = new Date(Date.UTC(yy, mm - 1, 1, -7, 0, 0));
  const end = new Date(Date.UTC(yy, mm, 1, -7, 0, 0));
  return { start, end };
}


function getThaiMonthLabel(yy, mm) {
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  return `${months[(Number(mm) || 1) - 1]} ${Number(yy) + 543}`;
}

// Dashboard
router.get("/", requireAdmin, async (req, res) => {
  try {
    // 🟣 Provider settings
    let ps = await ProviderSettings.findOne();
    if (!ps) ps = new ProviderSettings();

    const servicesTotal = await Service.countDocuments({});

    const salesOverview = await getAdminSalesOverview();
    const orderCount = salesOverview.orderCount;
    const otp24SuccessCount = salesOverview.otp24SuccessCount;
    const appsSuccessCount = salesOverview.appsSuccessCount;

    const userCount = await User.countDocuments({});

    // 🟢 ดึงรายการเติมเงิน pending + populate avatar
    const pendingTransactions = await Transaction.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({
        path: "userId",
        select: "username avatarUrl avatarVer email"
      })
      .lean();

    // 👉 สร้าง userMap ป้องกัน populate ไม่ครบ
    const uidList = [
      ...new Set(
        pendingTransactions
          .map(tx => (tx.userId?._id || tx.userId))
          .filter(Boolean)
          .map(String)
      ),
    ];

    let userMap = {};
    if (uidList.length) {
      const users = await User.find(
        { _id: { $in: uidList } },
        { username: 1, avatarUrl: 1, avatarVer: 1, email: 1 }
      ).lean();

      userMap = Object.fromEntries(
        users.map(u => [
          String(u._id),
          {
            username: u.username,
            avatarUrl: u.avatarUrl,
            avatarVer: u.avatarVer,
            email: u.email
          }
        ])
      );
    }

    // 🧩 เย็บข้อมูลใส่ tx.user ให้สมบูรณ์
    for (const tx of pendingTransactions) {
      const idStr = String(tx.userId?._id || tx.userId || "");
      const popUser = typeof tx.userId === "object" ? tx.userId : null;
      const mapUser = userMap[idStr] || null;

      // สร้างฟิลด์ user ให้สมบูรณ์ที่สุด
      tx.user = {
        username:
          popUser?.username || mapUser?.username || tx.user?.username || null,
        avatarUrl:
          popUser?.avatarUrl || mapUser?.avatarUrl || "/static/assets/img/user-blue.png",
        avatarVer:
          popUser?.avatarVer || mapUser?.avatarVer || 0,
        email:
          popUser?.email || mapUser?.email || null
      };

      tx.method = String(tx.method || "").toLowerCase();
    }

    // 🟩 wallets
    const webWallets = await Topup.find({ isActive: true }).lean();

    // OTP24 info
    const otp24Doc = await Otp24Setting.findOne({ name: "otp24" }).lean();
    const {
      lastBalance: otp24Bal = 0,
      lastSyncAt: otp24LastSyncAt = null,
      lastSyncError: otp24LastError = ""
    } = otp24Doc || {};

    const otp24ProductsTotal = await Otp24Product.countDocuments({
      provider: "otp24"
    });

    // 💰 ยอดเติมเงินเดือนล่าสุด (อิงเดือนปัจจุบันตามเวลาไทย)
    const bkkNow = getBangkokNowParts();
    const topupMonthStr = `${bkkNow.year}-${String(bkkNow.month).padStart(2, "0")}`;
    const topupMonthLabel = getThaiMonthLabel(bkkNow.year, bkkNow.month);
    const topupMonthRange = getBangkokMonthRange(bkkNow.year, bkkNow.month);
    const topupMonthAgg = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: topupMonthRange.start, $lt: topupMonthRange.end },
          status: "completed",
          method: { $ne: "admin" },
        },
      },
      { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    const topupMonthSum = topupMonthAgg?.[0]?.sum || 0;
    const topupMonthCount = topupMonthAgg?.[0]?.count || 0;

    const totalSoldCount = salesOverview.totalCount;

    // 🎯 Render
    res.render("admin/dashboard", {
      title: "หลังบ้าน",
      balance: ps.lastBalance || 0,
      servicesTotal,
      lastSyncAt: ps.lastSyncAt || null,
      transactions: pendingTransactions,
      webWallets,
      stats: {
        orderCount,
        userCount,
        otp24SuccessCount,
        appsSuccessCount,
        totalSoldCount,
        totalSoldSale: salesOverview.totalSale,
        serviceBreakdown: salesOverview.serviceBreakdown,
        topupMonthSum,
        topupMonthCount,
        topupMonthStr,
        topupMonthLabel,
      },
      otp24Bal,
      otp24LastSyncAt,
      otp24LastError,
      otp24ProductsTotal,
      otp24ProductsLastSyncAt: otp24Doc?.productsLastSyncAt ?? null
    });

  } catch (err) {
    glog.error("Dashboard error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

router.get("/users/list", requireAdmin, async (req, res) => {
  const users = await User.find({}, { username: 1, email: 1 }).lean();
  res.json({ ok: true, users });
});

// Refresh balance
router.post("/refresh-balance", requireAdmin, async (req, res) => {
  try {
    const balRaw = await getBalance();
    const candidates = ["balance", "credit", "credits", "amount"];
    const val = Number(
      candidates.map((k) => balRaw?.[k]).find((v) => v !== undefined)
    );
    let ps = await ProviderSettings.findOne();
    if (!ps) ps = new ProviderSettings();
    ps.lastBalance = Number.isFinite(val) ? val : 0;
    if (!ps.lastSyncAt) ps.lastSyncAt = new Date();
    await ps.save();
    res.json({ ok: true, balance: ps.lastBalance, raw: balRaw });
  } catch (e) {
    glog.error("refresh-balance error:", e?.response?.data || e);
    res.status(500).json({ ok: false, error: e.message || "refresh failed" });
  }
});

// Sync services
router.post('/sync-services', requireAdmin, async (req, res) => {
  // ✅ อนุญาตเฉพาะแอดมิน
  const me = req.user || req.session?.user;
  const isAdmin = !!(me?.role === 'admin' || me?.isAdmin);
  if (!isAdmin) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  // ✅ กันล็อกค้าง (ถ้าล็อกอยู่นานเกิน MAX_RUN_MS ให้ถือว่าหมดอายุ)
  if (SYNC_LOCK && (Date.now() - SYNC_STARTED_AT) > MAX_RUN_MS) {
    SYNC_LOCK = false; // clear stale lock
  }

  // ✅ กันซิงก์ซ้อน
  if (SYNC_LOCK) {
    return res.status(429).json({ ok: false, error: 'sync is already running' });
  }

  const t0 = Date.now();
  SYNC_LOCK = true;
  SYNC_STARTED_AT = t0;

  try {
    // ทำงานจริง
    const result = await syncServicesFromProvider(); // { count, skipped, logs }

    // อัปเดตสถานะการซิงก์ล่าสุด
    let ps = await ProviderSettings.findOne();
    if (!ps) ps = new ProviderSettings();

    ps.lastSyncAt = new Date();
    ps.lastSyncResult = {
      ok: true,
      count: result?.count ?? 0,
      skipped: result?.skipped ?? 0,
      logs: result?.logs ?? 0,
      durationMs: Date.now() - t0,
    };
    await ps.save();

    return res.json({
      ok: true,
      ...result,
      lastSyncAt: ps.lastSyncAt,
      durationMs: ps.lastSyncResult.durationMs,
    });
  } catch (e) {
    glog.error('Admin sync failed:', e?.response?.data || e);
    const msg = e?.response?.data?.message || e?.message || 'sync failed';

    // บันทึกผลล้มเหลวไว้ใน settings ด้วย
    try {
      let ps = await ProviderSettings.findOne();
      if (!ps) ps = new ProviderSettings();
      ps.lastSyncAt = new Date();
      ps.lastSyncResult = {
        ok: false,
        error: msg,
        durationMs: Date.now() - t0,
      };
      await ps.save();
    } catch { }

    return res.status(500).json({ ok: false, error: msg });
  } finally {
    SYNC_LOCK = false;
    SYNC_STARTED_AT = 0;
  }
});

const ALLOWED_ROLES = ["admin", "user"];
/**
 * GET /users
 * แสดงหน้า EJS การ์ดยูสเซอร์
 */
router.get("/users", requireAdmin, async (req, res) => {
  const users = await User.find(
    {},
    {
      username: 1,
      name: 1,
      role: 1,
      email: 1,
      emailVerified: 1,
      avatarUrl: 1,
      levelName: 1,
      balance: 1,
      totalSpent: 1,
      points: 1,
      totalOrders: 1,
      createdAt: 1,
      updatedAt: 1,
      serial_key: 1,
    }
  )
    .sort({ createdAt: -1 })
    .lean();

  res.render("admin/users", {
    title: "ข้อมูลผู้ใช้งาน",
    users,
  });
});

/**
 * GET /users/:id.json
 * ส่งข้อมูลเต็มของผู้ใช้ (ยกเว้นฟิลด์อ่อนไหว)
 */
router.get("/users/:id.json", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const u = await User.findById(id).lean();
    if (!u) return res.status(404).json({ ok: false, error: "ไม่พบผู้ใช้" });

    delete u.passwordHash;
    delete u.resetToken;
    delete u.twoFactorSecret;

    return res.json({ ok: true, user: u });
  } catch (e) {
    glog.error("GET /admin/users/:id.json error:", e);
    return res.status(500).json({ ok: false, error: "ดึงข้อมูลไม่สำเร็จ" });
  }
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, emailVerified, balance, bankAccounts } = req.body || {};
  const update = {};

  // name
  if (typeof name === "string") update.name = name.trim().slice(0, 100);

  // role
  if (typeof role === "string") {
    const r = role.trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(r)) {
      return res.status(400).json({ ok: false, error: "role ไม่ถูกต้อง" });
    }
    update.role = r;
  }

  // emailVerified
  if (typeof emailVerified !== "undefined")
    update.emailVerified = !!emailVerified;

  // balance
  if (typeof balance !== "undefined") {
    const n = Number(balance);
    if (!Number.isFinite(n) || n < 0) {
      return res
        .status(400)
        .json({ ok: false, error: "balance ต้องเป็นตัวเลขที่ถูกต้องและ ≥ 0" });
    }
    update.balance = Math.round(n * 100) / 100; // ทศนิยม 2
  }

  // bankAccounts (0–2 รายการ) + validate + กันซ้ำข้ามผู้ใช้
  if (Array.isArray(bankAccounts)) {
    if (bankAccounts.length > 2) {
      return res.status(400).json({ ok: false, error: "ได้ไม่เกิน 2 บัญชี" });
    }

    // แปลง/ตรวจความถูกต้องทีละแถว
    const rows = [];
    for (const r of bankAccounts) {
      const v = normalizeAndValidateAccount(r);
      if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      rows.push({
        accountCode: v.code,
        accountNumber: v.number,
        accountName: v.name,
      });
    }

    // กันซ้ำ: (accountCode, accountNumber) ต้องไม่อยู่ในผู้ใช้อื่น
    for (const r of rows) {
      const exists = await User.findOne({
        _id: { $ne: id },
        bankAccounts: {
          $elemMatch: {
            accountCode: r.accountCode,
            accountNumber: r.accountNumber,
          },
        },
      }).lean();
      if (exists) {
        return res.status(409).json({
          ok: false,
          error: `บัญชี ${r.accountCode} ${r.accountNumber} ถูกใช้งานในผู้ใช้อื่นแล้ว (1 บัญชีใช้ได้เพียง 1 ผู้ใช้)`,
        });
      }
    }

    // set ทับทั้งชุด (อนุญาตให้เป็น [] ได้ เพื่อเคลียร์)
    update.bankAccounts = rows;
  }

  if (Object.keys(update).length === 0) {
    return res
      .status(400)
      .json({ ok: false, error: "ไม่มีฟิลด์ที่แก้ไขได้ถูกส่งมา" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: update, $currentDate: { updatedAt: true } },
      { new: true, runValidators: true }
    ).lean();

    if (!user) return res.status(404).json({ ok: false, error: "ไม่พบผู้ใช้" });

    delete user.passwordHash;
    delete user.resetToken;
    delete user.twoFactorSecret;

    return res.json({ ok: true, user });
  } catch (e) {
    glog.error("PATCH /users/:id error:", e);
    return res.status(500).json({ ok: false, error: "บันทึกไม่สำเร็จ" });
  }
});

router.post("/manual-topup", requireAdmin, async (req, res) => {
  try {
    let { username, amount, txId, method } = req.body;

    // ── ตรวจข้อมูลพื้นฐาน ─────────────────────────────────────────
    if (!username || amount === undefined || amount === null) {
      return res.json({ ok: false, error: "ข้อมูลไม่ครบ" });
    }

    // รองรับ amount เป็น string มีคอมมา
    const amt = Math.round(Number(String(amount).replace(/,/g, "")) * 100) / 100;
    if (!(amt > 0)) {
      return res.json({ ok: false, error: "จำนวนเงินไม่ถูกต้อง" });
    }
    const amtCents = Math.round(amt * 100);

    // ── ปรับ/ตรวจค่า method ───────────────────────────────────────
    const ALLOWED_METHODS = ["admin", "truewallet", "kbank", "qr", "scb", "manual"];
    let m = String(method || "admin").toLowerCase();
    if (!ALLOWED_METHODS.includes(m)) m = "admin";

    // ── หา user ───────────────────────────────────────────────────
    const user = await User.findOne({ username });
    if (!user) return res.json({ ok: false, error: "ไม่พบผู้ใช้" });

    // ── เพิ่มยอดเข้า balance (บาท) ────────────────────────────────
    user.balance = Number(user.balance || 0) + amt;
    await user.save();

    const now = new Date();

    // ── อัปเดต/สร้าง Transaction ─────────────────────────────────
    if (txId) {
      // มี txId → upsert ให้ครบฟิลด์
      await Transaction.findOneAndUpdate(
        { transactionId: txId },
        {
          $set: {
            userId: user._id,
            username: user.username,
            method: m,              // ← ใช้ method ที่เลือก
            amount: amt,            // บาท
            amountCents: amtCents,  // สตางค์
            currency: "THB",
            status: "completed",
            updatedAt: now,
            paidAt: now,
          },
          $setOnInsert: {
            transactionId: txId,
            createdAt: now,
          },
        },
        { new: true, upsert: true }
      );
    } else {
      // ไม่มี txId → สร้างใหม่
      await Transaction.create({
        transactionId: ulid(),
        userId: user._id,
        username: user.username,
        method: m,              // ← ใช้ method ที่เลือก
        amount: amt,
        amountCents: amtCents,
        currency: "THB",
        status: "completed",
        createdAt: now,
        updatedAt: now,
        paidAt: now,
      });
    }

    // (ถ้ามีโมเดล topup_logs/WalletTransaction และอยากบันทึกแยก — ค่อยเพิ่มตรงนี้ได้)

    return res.json({
      ok: true,
      username,
      amount: amt,
      method: m,
      balance: user.balance,
    });
  } catch (err) {
    glog.error("admin-topup error:", err);
    return res.json({ ok: false, error: "เกิดข้อผิดพลาดในระบบ" });
  }
});

// ปฏิเสธรายการเติมเงิน
router.post('/topup/:id/reject', requireAdmin, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: '⛔️ ไม่มีสิทธิ์' });
    }

    const { id } = req.params;

    // หาได้ทั้งจาก _id และ transactionId
    const tx = isObjectId(id)
      ? await Transaction.findById(id)
      : await Transaction.findOne({ transactionId: id });

    if (!tx) return res.status(404).json({ ok: false, error: 'ไม่พบรายการ' });

    if (tx.status !== 'pending') {
      return res.status(400).json({
        ok: false,
        error: `สถานะปัจจุบันคือ "${tx.status}" ไม่สามารถปฏิเสธได้`
      });
    }

    tx.status = 'reject';          // ✅ ตรงกับ enum ใหม่นายแล้ว
    tx.rejectedAt = new Date();
    tx.rejectedBy = req.user?._id ?? null;

    // ไม่แตะ balance ผู้ใช้ เพราะยังไม่ได้เติม
    await tx.save();
    return res.json({ ok: true });
  } catch (err) {
    glog.error('reject tx error:', err);
    return res.status(500).json({ ok: false, error: 'เซิร์ฟเวอร์มีปัญหา' });
  }
});


// ✅ GET /orders — รายการออเดอร์ทั้งหมด
router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const { from, to, q = '', status = 'all' } = req.query || {};
    const filter = {};

    // วันที่ (inclusive)
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from + 'T00:00:00.000Z');
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
    }

    // สถานะ
    if (status && status !== 'all') {
      filter.status = String(status).toLowerCase();
    }

    // คำค้น
    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), 'i');
      filter.$or = [
        { providerOrderId: rx },
        { link: rx },
        { serviceName: rx },
        { 'service.name': rx },
        { 'service.providerServiceId': rx },
        { providerServiceId: rx },
        { 'user.username': rx },
        { 'user.email': rx },
        { 'user.name': rx },
      ];
    }

    // ── เพจจิเนชัน ─────────────────────────────────────────────
    const MAX_PER_PAGE = 1000;
    const pageParam = parseInt(req.query.page, 10);
    const perPageParam = (req.query.perPage ?? '').toString().toLowerCase();

    const total = await Order.countDocuments(filter);

    let perPage;
    if (perPageParam === 'all') {
      perPage = Math.max(1, total);       // แสดงทั้งหมด
    } else {
      const n = Number.isFinite(pageParam) ? (parseInt(req.query.perPage, 10) || 20)
        : (parseInt(req.query.perPage, 10) || 20);
      perPage = Math.min(Math.max(1, n), MAX_PER_PAGE);
    }

    const pages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
    const page = Math.min(Math.max(1, Number.isFinite(pageParam) ? pageParam : 1), pages);
    const skip = Math.max(0, (page - 1) * perPage);
    const limit = perPage;

    // ── ดึงรายการ ─────────────────────────────────────────────
    const listRaw = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'user', select: 'username email name avatarUrl role' },
        { path: 'service', select: 'name rate currency providerServiceId' },
      ])
      .lean();

    const list = (listRaw || []).map(o => {
      const st = String(o.status || '').toLowerCase();
      const isDone =
        st === 'completed' ||
        (typeof o.progress === 'number' && o.progress >= 99.995);
      const canCancel = st === 'processing';
      return { ...o, uiFlags: { isDone, canCancel } };
    });

    // ── ส่งให้วิว (admin/orders.ejs) ──────────────────────────
    res.render('admin/orders', {
      title: 'ออเดอร์ทั้งหมด (แอดมิน)',
      list,
      from,
      to,
      q,
      status,
      page,               // number
      perPage,            // number (ถ้าเลือก all จะเท่ากับ total)
      total,              // number
      syncError: null,
      bodyClass: 'orders-wide',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/users/search', requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(20, Number(req.query.limit) || 10);

    const cond = q
      ? { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      : {};

    const items = await User.find(cond)
      .select('_id username email role balance points')
      .sort({ username: 1 })
      .limit(limit)
      .lean();

    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// TOPUP REPORT (Admin)
// ─────────────────────────────────────────────────────────────
router.get('/topup-report', requireAdmin, async (req, res) => {
  const now = new Date();

  // mode=month | year
  const reportMode = String(req.query.mode || 'month').toLowerCase() === 'year' ? 'year' : 'month';

  // ===== helper คำนวณช่วงเวลาตามโซน Asia/Bangkok =====
  function getBangkokMonthRange(yy, mm) {
    // mm = 1..12
    // 00:00 น. ของกรุงเทพ (UTC+7) = 17:00 น. ของวันก่อนหน้าใน UTC
    const start = new Date(Date.UTC(yy, mm - 1, 1, -7, 0, 0));
    const end = new Date(Date.UTC(yy, mm, 1, -7, 0, 0));
    return { start, end };
  }

  function getBangkokYearRange(yy) {
    const start = new Date(Date.UTC(yy, 0, 1, -7, 0, 0));
    const end = new Date(Date.UTC(yy + 1, 0, 1, -7, 0, 0));
    return { start, end };
  }

  const METHOD_LABELS = {
    admin: 'แอดมิน',
    manual: 'เติมมือ',
    truewallet: 'True Wallet', tw: 'True Wallet',
    kbank: 'KBank',
    scb: 'SCB',
    qr: 'PromptPay QR',
  };

  // ===== month/year ที่เลือก =====
  const rawMonth = (req.query.month || '').slice(0, 7); // YYYY-MM
  const [yy, mm] = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
    ? rawMonth.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const selectedYearRaw = Number(req.query.year);
  const selectedYear = Number.isFinite(selectedYearRaw) && selectedYearRaw >= 2000 && selectedYearRaw <= 3000
    ? selectedYearRaw
    : yy;

  const monthStr = `${yy}-${String(mm).padStart(2, '0')}`;
  const monthRange = getBangkokMonthRange(yy, mm);
  const yearRange = getBangkokYearRange(selectedYear);

  const activeRange = reportMode === 'year' ? yearRange : monthRange;
  const activeMatch = { createdAt: { $gte: activeRange.start, $lt: activeRange.end } };

  // ===== รายการธุรกรรม =====
  // รายเดือน: แสดงรายการของเดือนนั้น
  // รายปี: แสดงรายการของทั้งปี เพื่อให้ modal/ตารางยังดูย้อนหลังได้ครบ
  const transactions = await Transaction.find(activeMatch)
    .sort({ createdAt: -1 })
    .populate({ path: 'userId', select: 'username email avatarUrl avatarVer' })
    .lean();

  // ===== รวม “ทั้งหมด” แต่ไม่เอาแอดมิน (completed เท่านั้น) =====
  const aggNoAdmin = await Transaction.aggregate([
    { $match: { ...activeMatch, status: 'completed', method: { $ne: 'admin' } } },
    { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const sumNoAdmin = aggNoAdmin?.[0]?.sum || 0;
  const countNoAdmin = aggNoAdmin?.[0]?.count || 0;

  // ===== รวมตามเมธอด (completed เท่านั้น) ตาม mode ที่เลือก =====
  const aggByMethod = await Transaction.aggregate([
    { $match: { ...activeMatch, status: 'completed' } },
    { $group: { _id: '$method', sum: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);

  const methodTotals = aggByMethod
    .map(m => ({
      method: String(m._id || '').toLowerCase(),
      label: METHOD_LABELS[String(m._id || '').toLowerCase()] || (m._id || 'ไม่ระบุ'),
      sum: m.sum || 0,
      count: m.count || 0,
    }))
    .filter(m => m.count > 0);

  // รวม completed ทั้งหมดตาม mode ที่เลือก (รวม admin ด้วย เผื่อใช้แสดงสรุปอื่น)
  const aggCompleted = await Transaction.aggregate([
    { $match: { ...activeMatch, status: 'completed' } },
    { $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const sumCompleted = aggCompleted?.[0]?.sum || 0;
  const countCompleted = aggCompleted?.[0]?.count || 0;

  // ===== รายงานรายปี: รวมยอดรายเดือนจาก DB ตามเวลา Bangkok =====
  const yearlyAgg = await Transaction.aggregate([
    {
      $match: {
        createdAt: { $gte: yearRange.start, $lt: yearRange.end },
        status: 'completed',
        method: { $ne: 'admin' },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m',
            date: '$createdAt',
            timezone: 'Asia/Bangkok',
          },
        },
        sum: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const yearlyMap = new Map(yearlyAgg.map(r => [r._id, r]));
  const yearlyRows = Array.from({ length: 12 }, (_, i) => {
    const key = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
    const row = yearlyMap.get(key);
    return {
      month: key,
      label: new Date(Date.UTC(selectedYear, i, 1)).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        month: 'long',
        year: 'numeric',
      }),
      sum: row?.sum || 0,
      count: row?.count || 0,
    };
  });

  res.render('admin/topup-report', {
    transactions,
    monthStr,
    selectedYear,
    reportMode,
    selectedLabel: reportMode === 'year' ? String(selectedYear) : monthStr,
    yearlyRows,
    sumNoAdmin,
    countNoAdmin,
    methodTotals,
    sumCompleted,
    countCompleted,
  });
});

router.post('/otp24hr/refresh-balance', requireAdmin, async (req, res) => {
  try {
    const r = await getOtp24Balance();
    const rawTrim = typeof r?.raw === 'string' ? r.raw.slice(0, 2000) : r?.raw;

    if (!r?.ok) {
      await Otp24Setting.findOneAndUpdate(
        { name: 'otp24' },
        {
          $set: { lastSyncAt: new Date(), lastSyncError: String(r?.error || 'fetch failed'), lastSyncResult: rawTrim ?? null },
          $currentDate: { updatedAt: true }
        },
        { upsert: true, new: true }
      );
      return res.status(500).json({ ok: false, error: r.error, raw: rawTrim, via: r.via });
    }

    await Otp24Setting.findOneAndUpdate(
      { name: 'otp24' },
      {
        $set: { lastBalance: Number(r.balance) || 0, lastSyncAt: new Date(), lastSyncError: '', lastSyncResult: rawTrim ?? null },
        $currentDate: { updatedAt: true }
      },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, balance: r.balance, currency: r.currency || 'THB', via: r.via });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// OTP24HR: Sync Products (admin)
// ─────────────────────────────────────────────────────────────
router.post('/otp24hr/sync-services', requireAdmin, async (req, res) => {
  try {
    const force = String(req.body?.force || req.query?.force || '1') !== '0';

    // ✅ ใช้ service กลางตัวเดียวกับ auto-sync เพื่อให้ผลเหมือนกันทุกทาง
    // - sync ใหม่ overwrite stock/ราคา/ชื่อ/รูป/raw ทับ DB เดิมทุกครั้ง
    // - สินค้าใหม่ถูกเพิ่มเข้า DB ทันที
    // - amount จาก provider คือคงเหลือจริง ไม่เอา sold มาหักซ้ำ
    const result = await syncOtp24ProductsAndBalance({ force });

    const upserted = Number(result?.upserted || 0);
    const active = Number(result?.active || 0);
    const total = Number(result?.total || upserted || active || 0);

    return res.json({
      ok: true,
      count: total,
      upserted,
      active,
      inactive: Number(result?.inactive || 0),
      balance: result?.balance ?? null,
      message: `ซิงก์ Apps/OTP24 สำเร็จ: อัปเดต/เพิ่ม ${upserted.toLocaleString('th-TH')} รายการ, พร้อมขาย ${active.toLocaleString('th-TH')} รายการ`,
      result,
    });
  } catch (e) {
    await Otp24Setting.findOneAndUpdate(
      { name: 'otp24' },
      {
        $set: {
          productsLastSyncAt: new Date(),
          lastSyncError: String(e?.message || e),
        },
        $currentDate: { updatedAt: true },
      },
      { upsert: true }
    );
    return res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// OTP REPORT (Admin) — หน้าเดียวมีสองแท็บ: ประวัติ / สรุปยอดขาย
// GET /admin/otp-report?mode=month&month=YYYY-MM
// GET /admin/otp-report?mode=year&year=YYYY
// ─────────────────────────────────────────────────────────────
router.get('/otp-report', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const reportMode = String(req.query.mode || 'month').toLowerCase() === 'year' ? 'year' : 'month';

    // ----- เดือนที่เลือกสำหรับแท็บประวัติ + โหมดรายเดือน -----
    const rawMonth = String(req.query.month || '').slice(0, 7); // 'YYYY-MM'
    const [yy, mm] = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const monthStart = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(yy, mm, 1, 0, 0, 0));
    const monthStr = `${yy}-${String(mm).padStart(2, '0')}`;

    // ----- ปีที่เลือกสำหรับโหมดรายปี -----
    const rawYear = Number(req.query.year);
    const selectedYear = Number.isFinite(rawYear) && rawYear >= 2000 && rawYear <= 2200
      ? Math.trunc(rawYear)
      : yy;

    const summaryStart = reportMode === 'year'
      ? new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0))
      : monthStart;

    const summaryEnd = reportMode === 'year'
      ? new Date(Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0))
      : monthEnd;

    // ---------------------------------------------
    // แท็บ 1: ประวัติสั่งซื้อ OTP (ดึงตามเดือน) + เติม username
    // ---------------------------------------------
    const ordersRaw = await Otp24Order.find({ createdAt: { $gte: monthStart, $lt: monthEnd }, ...OTP_ONLY_ORDER_FILTER })
      .sort({ createdAt: -1 })
      .populate({ path: 'user', select: 'username' })
      .lean();

    const orders = (ordersRaw || []).map(o => ({
      ...o,
      username: o.user?.username || '-',
    }));

    const countries = {};

    // ---------------------------------------------
    // แท็บ 2: สรุปยอดขาย OTP (เฉพาะ status: success)
    // - รายเดือน: rows = รายวัน
    // - รายปี: yearlyRows = รายเดือน 12 แถว
    // ---------------------------------------------
    const matchSummarySuccess = {
      createdAt: { $gte: summaryStart, $lt: summaryEnd },
      status: 'success',
    };

    const totalsAgg = await Otp24Order.aggregate([
      { $match: matchSummarySuccess },
      {
        $group: {
          _id: null,
          sale: { $sum: { $ifNull: ['$salePrice', 0] } },
          cost: { $sum: { $ifNull: ['$providerPrice', 0] } },
          count: { $sum: 1 },
        }
      }
    ]);

    const monthTotals = {
      sale: totalsAgg?.[0]?.sale || 0,
      cost: totalsAgg?.[0]?.cost || 0,
      count: totalsAgg?.[0]?.count || 0,
    };
    monthTotals.profit = monthTotals.sale - monthTotals.cost;

    // ---------------------------------------------
    // Hero stats: ต้องอิงช่วงเดียวกับโหมดรายงาน
    // - month = เดือนที่เลือก
    // - year  = ปีที่เลือก
    // เพื่อไม่ให้กำไรมีค่า แต่จำนวนสำเร็จยังเป็น 0
    // ---------------------------------------------
    const heroAgg = await Otp24Order.aggregate([
      { $match: { createdAt: { $gte: summaryStart, $lt: summaryEnd } } },
      {
        $group: {
          _id: { $toLower: { $ifNull: ['$status', 'processing'] } },
          count: { $sum: 1 },
        }
      }
    ]);

    const heroStatusMap = new Map((heroAgg || []).map(r => [String(r._id || '').toLowerCase(), Number(r.count || 0)]));
    const otpReportStats = {
      total: (heroAgg || []).reduce((sum, r) => sum + Number(r.count || 0), 0),
      success: heroStatusMap.get('success') || 0,
      processing: heroStatusMap.get('processing') || 0,
      profit: monthTotals.profit,
    };

    let rows = [];
    let yearlyRows = [];

    if (reportMode === 'year') {
      const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
      const yearlyAgg = await Otp24Order.aggregate([
        { $match: matchSummarySuccess },
        {
          $addFields: {
            monthKey: {
              $dateToString: {
                date: '$createdAt',
                format: '%Y-%m',
                timezone: 'Asia/Bangkok'
              }
            }
          }
        },
        {
          $group: {
            _id: '$monthKey',
            sale: { $sum: { $ifNull: ['$salePrice', 0] } },
            cost: { $sum: { $ifNull: ['$providerPrice', 0] } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const byMonth = new Map((yearlyAgg || []).map(r => [String(r._id), r]));
      yearlyRows = Array.from({ length: 12 }, (_, idx) => {
        const month = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
        const r = byMonth.get(month) || {};
        const sale = Number(r.sale || 0);
        const cost = Number(r.cost || 0);
        const count = Number(r.count || 0);
        return {
          month,
          monthNo: idx + 1,
          label: `${MONTHS_TH[idx]} ${selectedYear + 543}`,
          sale,
          cost,
          count,
          profit: sale - cost,
        };
      });
    } else {
      rows = await Otp24Order.aggregate([
        { $match: matchSummarySuccess },
        {
          $addFields: {
            day: {
              $dateToString: {
                date: '$createdAt',
                format: '%Y-%m-%d',
                timezone: 'Asia/Bangkok'
              }
            }
          }
        },
        {
          $group: {
            _id: '$day',
            sale: { $sum: { $ifNull: ['$salePrice', 0] } },
            cost: { $sum: { $ifNull: ['$providerPrice', 0] } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).then(list => list.map(r => ({
        day: r._id,
        sale: r.sale || 0,
        cost: r.cost || 0,
        count: r.count || 0,
        profit: (r.sale || 0) - (r.cost || 0),
      })));
    }

    res.render('admin/otp-report', {
      orders,
      countries,
      monthStr,
      reportMode,
      selectedYear,
      monthTotals,
      otpReportStats,
      rows,
      yearlyRows,
    });
  } catch (e) {
    glog.error('GET /admin/otp-report error:', e);
    res.status(500).send('เกิดข้อผิดพลาดในระบบ');
  }
});

// ─────────────────────────────────────────────────────────────
// BONUSTIME PANEL (Admin)
// ─────────────────────────────────────────────────────────────
// GET /admin/bonustime-panel
router.get("/bonustime-panel", requireAdmin, async (req, res) => {
  try {
    const col = await getBonustimeUsersCollection();

    // ========== PART 1: Tenant Records (TAB 1)
    const docs = await col
      .find({})
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    const tenantIds = docs.map((d) => d.tenantId).filter(Boolean);
    const serialKeys = docs.map((d) => d.serial_key).filter(Boolean);

    let ownerByTenant = {};
    let ownerBySerial = {};
    let ownerDisplayBySerial = {};

    // ---------- 1) จาก BonustimeOrder ----------
    try {
      const btOrders = await BonustimeOrder.find({
        $or: [
          { tenantId: { $in: tenantIds } },
          { serial_key: { $in: serialKeys } },
          { serialKey: { $in: serialKeys } },
        ]
      })
        .populate({ path: "user", select: "username" })
        .lean();

      for (const o of btOrders || []) {
        const uName = o.user?.username || null;
        const dName = o.user?.name || o.user?.username || null;
        if (uName) {
          const t = o.tenantId || o.tenant || null;
          const sk = o.serial_key || o.serialKey || null;
          if (t) {
            ownerByTenant[t] = uName;
          }
          if (sk) {
            ownerBySerial[sk] = uName;
            ownerDisplayBySerial[sk] = dName;
          }
        }
      }
    } catch (err) {
      glog.warn("Owner map error:", err.message);
    }
    // ---------- 2) จาก User.serial_key โดยตรง ----------
    try {
      if (serialKeys.length) {
        const users = await User.find({
          serial_key: { $in: serialKeys }
        })
          .select("username name serial_key")
          .lean();

        for (const u of users || []) {
          const sk = u.serial_key;
          if (!sk) continue;

          // ถ้า map จาก order ยังไม่มี ให้เติมจาก user
          if (!ownerBySerial[sk]) {
            ownerBySerial[sk] = u.username;
          }
          if (!ownerDisplayBySerial[sk]) {
            ownerDisplayBySerial[sk] = u.name || u.username;
          }
        }
      }
    } catch (err) {
      glog.warn("Owner map (users) error:", err.message);
    }

    // ---------- สร้าง records ส่งเข้า EJS ----------
    const records = docs.map((doc) => {
      const expiry = computeLicenseExpiry(doc);

      const ownerUsername =
        ownerByTenant[doc.tenantId] ||
        ownerBySerial[doc.serial_key] ||
        null;

      const ownerDisplayName =
        doc.ownerName ||
        ownerDisplayBySerial[doc.serial_key] ||
        null;

      return {
        tenantId: doc.tenantId || "",
        serial_key: doc.serial_key || "",
        NAME: doc.NAME || "",
        LOGO: doc.LOGO || "",
        LOGIN_URL: doc.LOGIN_URL || "",
        SIGNUP_URL: doc.SIGNUP_URL || "",
        LINE_ADMIN: doc.LINE_ADMIN || "",
        LOTTO_ENABLED: !!doc.LOTTO_ENABLED,
        LICENSE_START_DATE: doc.LICENSE_START_DATE || "",
        LICENSE_DURATION_DAYS: Number(doc.LICENSE_DURATION_DAYS || 0),
        LICENSE_DISABLED: !!doc.LICENSE_DISABLED,
        CHANNEL_ACCESS_TOKEN: doc.CHANNEL_ACCESS_TOKEN || "",
        CHANNEL_SECRET: doc.CHANNEL_SECRET || "",
        LINK: doc.LINK || doc.webhookUrl || (doc.serviceKey ? makeWebhookUrl(doc.serviceKey) : ""),
        legacyTenantId: doc.legacyTenantId || "",
        serviceMode: doc.serviceMode || "",
        serviceGroup: doc.serviceGroup || "",
        serviceNo: doc.serviceNo || null,
        serviceKey: doc.serviceKey || "",
        webhookUrl: doc.webhookUrl || "",
        webhookPath: doc.webhookPath || "",
        sharedServiceName: doc.sharedServiceName || "",
        publicTenantKey: doc.serviceKey || doc.tenantId || "",
        username: ownerUsername,
        ownerName: ownerDisplayName,
        note: doc.note || "",
        createdAtLabel: fmtDateLabel(doc.createdAt),
        updatedAtLabel: fmtDateLabel(doc.updatedAt),
        expiresAtLabel: expiry.label,
        expiresAtInput: expiry.input,
        licenseDisabled: expiry.disabled,
        raw: doc
      };
    });

    // ================== PART 2: Ultra Mode Summary (TAB 2)
    const monthNamesTH = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    const now = new Date();

    // -------------------------------
    // 🟦 1) รับค่าเดือนจาก FE (รองรับ YYYY-MM)
    // -------------------------------
    let year, month;
    const rawMonth = req.query.month; // อาจเป็น "2025-11" หรือ "12-2568"

    // ถ้ารูปแบบ YYYY-MM
    if (rawMonth && rawMonth.includes("-")) {
      const parts = rawMonth.split("-");
      if (parts.length === 2) {
        const yy = Number(parts[0]);
        const mm = Number(parts[1]);

        if (!isNaN(yy) && !isNaN(mm)) {
          year = yy;
          month = mm;
        }
      }
    }

    // Fallback ถ้า FE ส่งแบบเดิม
    if (!year || !month) {
      month = Number(req.query.month || (now.getMonth() + 1));
      year = Number(req.query.year || now.getFullYear());
    }

    // ป้องกัน NaN
    if (isNaN(month) || month < 1 || month > 12) month = now.getMonth() + 1;
    if (isNaN(year) || year < 2000) year = now.getFullYear();

    const yearBE = year + 543;

    // -------------------------------
    // 🟦 2) ช่วงวันที่ของเดือนนั้น
    // -------------------------------
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    // glog.log("⭐ Loaded Month:", { year, month, start, end });

    // -------------------------------
    // 🟦 3) Query orders ของเดือนนั้นจริง ๆ
    // -------------------------------
    const monthOrders = await BonustimeOrder.find({
      createdAt: { $gte: start, $lt: end }
    }).lean();

    // glog.log("📌 monthOrders length =", monthOrders.length);

    // -------------------------------
    // 🟦 4) คำนวณยอดทั้งหมด
    // -------------------------------
    let totalRevenue = 0;
    let pkg1Revenue = 0;
    let pkg2Revenue = 0;
    let pkg1Count = 0;
    let pkg2Count = 0;

    const typeStats = {};

    const daily = {}; // สำหรับเก็บยอดรายวัน

    for (const o of monthOrders) {
      const amount = Number(o.amountTHB || 0);
      const created = new Date(o.createdAt);
      const day = created.getUTCDate(); // 1..31

      if (!daily[day]) {
        daily[day] = { total: 0, pkg1: 0, pkg2: 0, count: 0 };
      }

      daily[day].total += amount;
      daily[day].count++;

      totalRevenue += amount;

      // จัดกลุ่ม packageType
      const t = (o.packageType || "").toLowerCase();

      if (!typeStats[t]) typeStats[t] = { count: 0, total: 0 };
      typeStats[t].count++;
      typeStats[t].total += amount;

      // Mapping package ให้ถูกต้อง
      const isPkg1 = ["normal", "pack1", "package1"].includes(t);
      const isPkg2 = ["lotto", "pack2", "package2"].includes(t);

      if (isPkg1) {
        daily[day].pkg1 += amount;
        pkg1Revenue += amount;
        pkg1Count++;
      } else if (isPkg2) {
        daily[day].pkg2 += amount;
        pkg2Revenue += amount;
        pkg2Count++;
      } else {
        // ถ้าไม่รู้ type → ใส่ pkg1
        daily[day].pkg1 += amount;
        pkg1Revenue += amount;
        pkg1Count++;
      }
    }

    // -------------------------------
    // 🟦 5) Top 5 days
    // -------------------------------
    const top5 = Object.entries(daily)
      .map(([d, rec]) => ({ day: Number(d), amount: rec.total }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // -------------------------------
    // 🟦 6) Generate รายวันให้ครบเดือน
    // -------------------------------
    const daysInMonth = new Date(year, month, 0).getDate();

    const dailyLabels = [];
    const dailyDataArr = [];
    const pkg1DataArr = [];
    const pkg2DataArr = [];
    const dailyOrderCountArr = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const rec = daily[d] || { total: 0, pkg1: 0, pkg2: 0, count: 0 };
      dailyLabels.push(String(d));
      dailyDataArr.push(rec.total);
      pkg1DataArr.push(rec.pkg1);
      pkg2DataArr.push(rec.pkg2);
      dailyOrderCountArr.push(rec.count);
    }

    // -------------------------------
    // 🟦 7) ส่งไป render
    // -------------------------------
    return res.render("admin/bonustime_panel", {
      title: "Bonustime Panel",
      top5: JSON.stringify(top5),

      records,
      updateEndpoint: "/admin/bonustime/tenant",

      year: yearBE,
      month: monthNamesTH[month - 1],
      monthOrders,
      typeStats,
      totalRevenue,
      pkg1Revenue,
      pkg2Revenue,
      pkg1Count,
      pkg2Count,
      orderCount: monthOrders.length,

      dailyLabels,
      dailyData: dailyDataArr,
      pkg1Data: pkg1DataArr,
      pkg2Data: pkg2DataArr,
      dailyOrderCounts: dailyOrderCountArr,
    });

  } catch (err) {
    glog.error("GET /admin/bonustime-panel error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล Bonustime");
  }
});


// PATCH /admin/bonustime/tenant/:tenantId — auto-save ฟิลด์ใน section
router.patch("/bonustime/tenant/:tenantId", requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { field, value } = req.body || {};

    if (!tenantId || !field) {
      return res
        .status(400)
        .json({ ok: false, error: "tenantId หรือ field ไม่ถูกต้อง" });
    }

    // ✅ อนุญาตทุก field ที่เราจะให้แก้ (ยกเว้น TenantID / username / serial)
    const allowed = new Set([
      "NAME",
      "ownerName",
      "expiresAt",
      "LINK",
      "webhookUrl",
      "note",

      "LOGO",
      "LOGIN_URL",
      "SIGNUP_URL",
      "LINE_ADMIN",

      "LOTTO_ENABLED",
      "LICENSE_DISABLED",
      "LICENSE_START_DATE",
      "LICENSE_DURATION_DAYS",

      "CHANNEL_ACCESS_TOKEN",
      "CHANNEL_SECRET",
      "serial_key",
    ]);

    if (!allowed.has(field)) {
      return res
        .status(400)
        .json({ ok: false, error: "field นี้ไม่อนุญาตให้แก้ไข" });
    }

    const col = await getBonustimeUsersCollection();
    const update = {};

    if (field === "expiresAt") {
      if (value) {
        const d = new Date(String(value) + "T00:00:00.000Z");
        if (!Number.isFinite(d.getTime())) {
          return res
            .status(400)
            .json({ ok: false, error: "รูปแบบวันหมดอายุไม่ถูกต้อง" });
        }
        update.expiresAt = d;
      } else {
        update.expiresAt = null;
      }

    } else if (field === "NAME") {
      update.NAME = String(value || "").trim().slice(0, 100);

    } else if (field === "LINK" || field === "webhookUrl") {
      update.LINK = String(value || "").trim();
      update.webhookUrl = String(value || "").trim();

    } else if (field === "ownerName") {
      update.ownerName = String(value || "").trim();

    } else if (field === "note") {
      update.note = String(value || "").trim();

      // ---------- config จาก RT AUTOBOT ----------
    } else if (field === "LOGO") {
      update.LOGO = String(value || "").trim();

    } else if (field === "LOGIN_URL") {
      update.LOGIN_URL = String(value || "").trim();

    } else if (field === "SIGNUP_URL") {
      update.SIGNUP_URL = String(value || "").trim();

    } else if (field === "LINE_ADMIN") {
      update.LINE_ADMIN = String(value || "").trim();

    } else if (field === "LOTTO_ENABLED") {
      // มาจาก select value="true"/"false"
      const boolVal = value === true || value === "true";
      update.LOTTO_ENABLED = boolVal;

    } else if (field === "LICENSE_DISABLED") {
      const boolVal = value === true || value === "true";
      update.LICENSE_DISABLED = boolVal;
      // ถ้าปิดระบบวันหมดอายุ เคลียร์ expiresAt ทิ้ง (กันสับสน)
      if (boolVal) {
        update.expiresAt = null;
      }

    } else if (field === "LICENSE_START_DATE") {
      // เก็บ string ตามที่ RT AUTOBOT ให้มา (เช่น 29/09/2568)
      update.LICENSE_START_DATE = String(value || "").trim();

    } else if (field === "LICENSE_DURATION_DAYS") {
      const num = parseInt(value, 10);
      update.LICENSE_DURATION_DAYS = Number.isFinite(num) && num >= 0 ? num : 0;

    } else if (field === "CHANNEL_ACCESS_TOKEN") {
      update.CHANNEL_ACCESS_TOKEN = String(value || "");

    } else if (field === "CHANNEL_SECRET") {
      update.CHANNEL_SECRET = String(value || "");

    } else if (field === "serial_key") {
      update.serial_key = String(value || "").trim();
      // ถ้าอยากบังคับให้ไม่ว่างก็เพิ่มเช็คตรงนี้ได้ภายหลัง
      // if (!update.serial_key) { ... return error ... }
    }

    const result = await col.updateOne(
      { tenantId },
      {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
        $setOnInsert: { tenantId },
      }
    );

    if (!result.matchedCount && !result.upsertedCount) {
      return res
        .status(404)
        .json({ ok: false, error: "ไม่พบ tenantId นี้ใน Bonustime DB" });
    }

    return res.json({ ok: true, updated: true });
  } catch (err) {
    glog.error("PATCH /admin/bonustime/tenant error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" });
  }
});

router.get("/bonustime/tenant", requireAdmin, async (req, res) => {
  const { month, year } = req.query;  // Parse the query params
  if (!month || !year) {
    return res.status(400).json({ ok: false, error: "เดือนหรือปีไม่ถูกต้อง" });
  }

  const startDate = new Date(`${year}-${month}-01`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  // ตรวจสอบว่า startDate และ endDate เป็นวันที่ที่ถูกต้อง
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ ok: false, error: "เดือนหรือปีที่เลือกไม่ถูกต้อง" });
  }

  // คิวรีข้อมูลจากฐานข้อมูล
  const monthOrders = await BonustimeOrder.find({
    createdAt: { $gte: startDate, $lt: endDate }
  }).lean();

  // คำนวณยอดขาย
  let totalRevenue = 0;
  let pkg1Revenue = 0;
  let pkg2Revenue = 0;
  let pkg1Count = 0;
  let pkg2Count = 0;
  let daily = {};

  monthOrders.forEach(o => {
    const amt = Number(o.amountTHB || 0);

    const created = new Date(o.createdAt);
    const day = created.getUTCDate(); // 1..31

    if (!daily[day]) {
      daily[day] = { total: 0, pkg1: 0, pkg2: 0, count: 0 };
    }

    // ---- รวมรายวัน
    daily[day].total += amt;
    daily[day].count++;

    // ---- รวมรายเดือนทั้งหมด
    totalRevenue += amt;

    // ====== PACKAGE MAPPING แบบใหม่ (ครอบทุกเคส) ======
    const type = (o.packageType || "").toLowerCase();

    const isPkg1 = ["normal", "pack1", "package1"].includes(type);
    const isPkg2 = ["lotto", "pack2", "package2"].includes(type);

    if (isPkg1) {
      daily[day].pkg1 += amt;
      pkg1Revenue += amt;
      pkg1Count++;
    } else if (isPkg2) {
      daily[day].pkg2 += amt;
      pkg2Revenue += amt;
      pkg2Count++;
    } else {
      // ถ้าไม่มีค่า ให้โยนเข้า pkg1 เป็น default (ตามระบบเดิม)
      daily[day].pkg1 += amt;
      pkg1Revenue += amt;
      pkg1Count++;
    }
  });

  const top5 = Object.entries(daily)
    .map(([d, amt]) => ({ day: Number(d), amount: amt }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // ส่งข้อมูลกลับในรูปแบบ JSON
  res.json({
    ok: true,
    totalRevenue,
    pkg1Revenue,
    pkg2Revenue,
    pkg1Count,
    pkg2Count,
    orderCount: monthOrders.length,
    dailyData: Object.values(daily),
    pkg1Data: [pkg1Revenue],
    pkg2Data: [pkg2Revenue],
    top5,
  });
});

// สร้าง Tenant / Serial ใหม่
router.post("/bonustime/tenant", requireAdmin, async (req, res) => {
  try {
    const { LOTTO_ENABLED } = req.body || {};
    const wantLotto = LOTTO_ENABLED === true || LOTTO_ENABLED === "true" || LOTTO_ENABLED === "1";

    const col = await getBonustimeUsersCollection();
    const identity = await getNextServiceIdentity(col, wantLotto);
    const now = new Date();

    // แปลงวันที่เป็นรูปแบบไทย dd/MM/yyyy (พ.ศ.)
    const toThaiDate = (d) => {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear() + 543;
      return `${day}/${month}/${year}`;
    };

    const doc = {
      // Legacy fields: keep them for existing Bonustime code compatibility.
      tenantId: identity.serviceKey,
      legacyTenantId: identity.serviceKey,
      serviceMode: identity.serviceMode,
      serviceGroup: identity.serviceGroup,
      serviceNo: identity.serviceNo,
      serviceKey: identity.serviceKey,
      webhookPath: identity.webhookPath,
      webhookUrl: identity.webhookUrl,
      sharedServiceName: identity.sharedServiceName,

      serial_key: "",
      CHANNEL_ACCESS_TOKEN: "",
      CHANNEL_SECRET: "",
      LOGO: "https://img5.pic.in.th/file/secure-sv1/LOGO-RT-AUTO-BOT-3.png",
      LOGIN_URL: "https://rtsmm-th.com/bonustime",
      SIGNUP_URL: "https://rtsmm-th.com/bonustime",
      LINE_ADMIN: "https://lin.ee/uaOykAk",
      ALLOW_TEXT_PROVIDER: false,
      LOTTO_ENABLED: wantLotto,
      LICENSE_START_DATE: toThaiDate(now),
      LICENSE_DURATION_DAYS: 30,
      LICENSE_DISABLED: false,
      LICENSE_ALLOW_JSON: false,
      LICENSE_JSON_PATH: "./license.config.json",
      LINK: identity.webhookUrl,
      NAME: "",
      ownerName: "",
      note: wantLotto ? "แพ็กเกจ 2 (สล็อต+บาคาร่า+หวย)" : "แพ็กเกจ 1 (สล็อต+บาคาร่า)",
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(doc);

    return res.json({
      ok: true,
      insertedId: result.insertedId,
      serviceKey: identity.serviceKey,
      webhookUrl: identity.webhookUrl,
    });
  } catch (err) {
    glog.error("POST /admin/bonustime/tenant error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "สร้างรายการไม่สำเร็จ กรุณาลองใหม่" });
  }
});

// =============================
// BONUSTIME MONTHLY REPORT (Ultra Mode)
// =============================
router.get("/bonustime/monthly.json", requireAdmin, async (req, res) => {
  try {
    let { month } = req.query;

    // ===========================
    // 1) แปลงค่าเดือนจาก FE (YYYY-MM)
    // ===========================
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;

    if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
      const [yy, mm] = month.split("-").map(Number);
      if (!isNaN(yy) && !isNaN(mm) && mm >= 1 && mm <= 12) {
        y = yy;
        m = mm;
      }
    }

    // ===========================
    // 2) สร้างช่วงเวลาแบบ UTC
    // ===========================
    const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));

    // glog.log("📅 MONTH RANGE:", { start, end });

    // ===========================
    // 3) Query orders ของเดือนที่เลือกจริง
    // ===========================
    const orders = await BonustimeOrder.find({
      createdAt: { $gte: start, $lt: end }
    }).lean();

    // glog.log("📦 Orders count =", orders.length);

    // ===========================
    // 4) ตัวแปรรวมยอด
    // ===========================
    let totalMonth = 0;
    let pkg1Month = 0;
    let pkg2Month = 0;
    let pkg1Count = 0;
    let pkg2Count = 0;

    // ใช้รายวันแบบ Map
    const dailyMap = {}; // { 1: {...}, 2: {...}, ... }

    for (const o of orders) {
      const amt = Number(o.amountTHB || 0) || 0;

      const created = new Date(o.createdAt);
      const day = created.getUTCDate(); // 1..31

      if (!dailyMap[day]) {
        dailyMap[day] = { day, pkg1: 0, pkg2: 0, total: 0 };
      }

      const type = (o.packageType || "").toLowerCase();

      const isPkg1 = ["normal", "pack1", "package1"].includes(type);
      const isPkg2 = ["lotto", "pack2", "package2"].includes(type);

      // รวมรายเดือน
      if (isPkg1) {
        pkg1Month += amt;
        pkg1Count++;
        dailyMap[day].pkg1 += amt;
      } else if (isPkg2) {
        pkg2Month += amt;
        pkg2Count++;
        dailyMap[day].pkg2 += amt;
      }

      totalMonth += amt;
      dailyMap[day].total += amt;
    }

    // ===========================
    // 5) แปลงรายวันเป็น array & sort
    // ===========================
    const daily = Object.values(dailyMap).sort((a, b) => a.day - b.day);

    // ===========================
    // 6) Top 5 วันยอดขายสูงสุด
    // ===========================
    const top5 = [...daily]
      .filter(d => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(d => ({
        day: d.day,
        amount: d.total
      }));

    // ===========================
    // 7) ส่งข้อมูลกลับ FE
    // ===========================
    res.json({
      ok: true,
      month: `${y}-${String(m).padStart(2, "0")}`,
      totalMonth,
      pkg1Month,
      pkg2Month,
      pkg1Count,
      pkg2Count,
      bothPkg: pkg1Month + pkg2Month,
      orderCount: orders.length,
      daily,
      top5
    });

  } catch (err) {
    glog.error("❌ ERR GET /bonustime/monthly.json", err);
    res.status(500).json({ ok: false, error: "server-error" });
  }
});

// DELETE /admin/bonustime/tenant/:tenantId — ลบ Service ออกจาก Bonustime DB
router.delete("/bonustime/tenant/:tenantId", requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res
        .status(400)
        .json({ ok: false, error: "tenantId ไม่ถูกต้อง" });
    }

    const col = await getBonustimeUsersCollection();

    const result = await col.deleteOne({ tenantId });

    if (!result.deletedCount) {
      return res
        .status(404)
        .json({ ok: false, error: "ไม่พบ Service นี้ใน Bonustime DB" });
    }

    return res.json({ ok: true, deleted: true });
  } catch (err) {
    glog.error("DELETE /admin/bonustime/tenant error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "ลบไม่สำเร็จ กรุณาลองใหม่" });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN SETTINGS PAGE
// ─────────────────────────────────────────────────────────────
router.get("/settings", requireAdmin, async (req, res) => {
  try {
    await connectMongoIfNeeded();

    const canEdit = await isDevUser(req);

    // secure_config: เอา doc แรก
    const db = mongoose.connection.db;
    const secureCol = db.collection("secure_config");
    const secure = await secureCol.findOne({}) || {};

    // topup accounts: เฉพาะ type = DEPOSIT
    const wallets = await Topup.find({ type: "DEPOSIT" })
      .sort({ accountCode: 1 })
      .lean();

    res.render("admin/admin_setting", {
      title: "ตั้งค่าเว็บไซต์",
      secure,
      wallets,
      canEdit,
    });
  } catch (err) {
    glog.error("GET /admin/settings error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
  }
});

// บันทึก secure_config (dev เท่านั้น)
router.post("/settings/secure", requireAdmin, async (req, res) => {
  try {
    if (!(await isDevUser(req))) {
      return res.status(403).send("เฉพาะ dev เท่านั้นที่สามารถแก้ไขได้");
    }

    await connectMongoIfNeeded();
    const db = mongoose.connection.db;
    const secureCol = db.collection("secure_config");

    const body = req.body || {};

    const pick = (name, def = "") => {
      const v = body[name];
      const val = Array.isArray(v) ? v[v.length - 1] : v;
      if (val === undefined || val === null) return def;
      return String(val).trim();
    };

    const pickNum = (name, def = 0, opts = {}) => {
      const n = Number(pick(name, ""));
      let val = Number.isFinite(n) ? n : def;
      if (Number.isFinite(opts.min)) val = Math.max(opts.min, val);
      if (Number.isFinite(opts.max)) val = Math.min(opts.max, val);
      return val;
    };

    const pickBool = (name, def = false) => {
      const v = body[name];
      if (v === undefined || v === null) return !!def;
      const val = Array.isArray(v) ? v[v.length - 1] : v;
      return ["1", "true", "on", "yes"].includes(String(val).trim().toLowerCase());
    };

    // map จากฟอร์ม → โครงสร้าง secure_config แบบครบชุด
    const doc = {
      ipv: {
        apiBase: pick("ipv_apiBase"),
        apiKey: pick("ipv_apiKey"),
      },
      mail: {
        host: pick("mail_host"),
        port: pickNum("mail_port", 587, { min: 1 }),
        user: pick("mail_user"),
        pass: pick("mail_pass"),
        from: pick("mail_from"),
        debug: pickBool("mail_debug", false),
        secure: pickBool("mail_secure", false),
      },
      otp: {
        ttlSec: pickNum("otp_ttlSec", 600, { min: 1 }),
        resendCooldownSec: pickNum("otp_resendCooldownSec", 60, { min: 0 }),
        maxAttempts: pickNum("otp_maxAttempts", 5, { min: 1 }),
      },
      port: pickNum("port", 3000, { min: 1 }),
      sessionSecret: pick("sessionSecret"),
      TW_GEN_LINK_SECRET: pick("TW_GEN_LINK_SECRET"),
      otp24: {
        apiBase: pick("otp24_apiBase"),
        apiKey: pick("otp24_apiKey"),
      },
      turnstile: {
        siteKey: pick("turnstile_siteKey"),
        secretKey: pick("turnstile_secretKey"),
      },
      system: {
        globalLogEnabled: pickBool("system_globalLogEnabled", false),
        tz: pick("system_tz", "Asia/Bangkok") || "Asia/Bangkok",
        workerConcurrency: pickNum("system_workerConcurrency", 5, { min: 1 }),
        jwtSecret: pick("system_jwtSecret"),
        syncIndexes: pickBool("system_syncIndexes", true),
        secureConfigAutoReloadEnabled: pickBool("system_secureConfigAutoReloadEnabled", true),
        secureConfigReloadIntervalMs: pickNum("system_secureConfigReloadIntervalMs", 5000, { min: 1000 }),
      },
      jobs: {
        orderStatusTickMs: pickNum("jobs_orderStatusTickMs", 60000, { min: 1000 }),
        orderStatusConcurrency: pickNum("jobs_orderStatusConcurrency", 20, { min: 1 }),
        orderStatusBatchLimit: pickNum("jobs_orderStatusBatchLimit", 300, { min: 1 }),
        orderStatusFastScanMs: pickNum("jobs_orderStatusFastScanMs", 2000, { min: 500 }),
        orderStatusAutoCancelAfterMs: pickNum("jobs_orderStatusAutoCancelAfterMs", 43200000, { min: 0 }),
        otp24SweeperIntervalMs: pickNum("jobs_otp24SweeperIntervalMs", 3000, { min: 500 }),
        otp24SweeperBatchLimit: pickNum("jobs_otp24SweeperBatchLimit", 100, { min: 1 }),
        otp24SweeperConcurrency: pickNum("jobs_otp24SweeperConcurrency", 3, { min: 1 }),
        telegramCheckIntervalMs: pickNum("jobs_telegramCheckIntervalMs", 5000, { min: 1000 }),
        telegramCheckBatchLimit: pickNum("jobs_telegramCheckBatchLimit", 150, { min: 1 }),
        dailyChangeSyncTelegramSummary: pickBool("jobs_dailyChangeSyncTelegramSummary", false),
        dailyChangeSyncTelegramTimeoutMs: pickNum("jobs_dailyChangeSyncTelegramTimeoutMs", 10000, { min: 1000 }),
        dailyChangeSyncCron: pick("jobs_dailyChangeSyncCron", "0 7 * * *") || "0 7 * * *",
        topupRejectCron: pick("jobs_topupRejectCron", "*/1 * * * *") || "*/1 * * * *",
        topupRejectBatchSize: pickNum("jobs_topupRejectBatchSize", 50, { min: 1 }),
        topupRejectAgeHours: pickNum("jobs_topupRejectAgeHours", 12, { min: 0 }),
        bonustimeExpiryCron: pick("jobs_bonustimeExpiryCron", "*/5 * * * *") || "*/5 * * * *",
        bonustimeExpiryBatchSize: pickNum("jobs_bonustimeExpiryBatchSize", 100, { min: 1 }),
        topupRejectAgeMinutes: pickNum("jobs_topupRejectAgeMinutes", 1, { min: 0 }),
      },
      botBlock: {
        enabled: pickBool("botBlock_enabled", false),
        logEnabled: pickBool("botBlock_logEnabled", false),
        action: pickNum("botBlock_action", 404),
        aggWindowMs: pickNum("botBlock_aggWindowMs", 300000, { min: 1000 }),
        consoleSampleMs: pickNum("botBlock_consoleSampleMs", 30000, { min: 1000 }),
        logTtlDays: pickNum("botBlock_logTtlDays", 30, { min: 1 }),
        geoipEnabled: pickBool("botBlock_geoipEnabled", true),
        geoipTimeoutMs: pickNum("botBlock_geoipTimeoutMs", 900, { min: 100 }),
        geoipCacheDays: pickNum("botBlock_geoipCacheDays", 30, { min: 1 }),
        ipBanEnabled: pickBool("botBlock_ipBanEnabled", true),
        ipBanThreshold: pickNum("botBlock_ipBanThreshold", 2, { min: 1 }),
        ipBanWindowMs: pickNum("botBlock_ipBanWindowMs", 86400000, { min: 1000 }),
        ipBanCacheMs: pickNum("botBlock_ipBanCacheMs", 300000, { min: 1000 }),
        banStatus: pickNum("botBlock_banStatus", 403),
        ipBanDays: pickNum("botBlock_ipBanDays", 365, { min: 1 }),
      },
      railway: {
        apiToken: pick("railway_apiToken"),
        projectId: pick("railway_projectId"),
      },
      telegram: {
        botToken: pick("telegram_botToken"),
        channelId: pick("telegram_channelId"),
      },
      brand: {
        url: pick("brand_url"),
      },
      session: {
        name: pick("session_name", "connect.sid") || "connect.sid",
      },
      security: {
        clientSourceProtectionEnabled: pickBool("security_clientSourceProtectionEnabled", true),
        inlineScriptObfuscationEnabled: pickBool("security_inlineScriptObfuscationEnabled", true),
        publicJsObfuscationEnabled: pickBool("security_publicJsObfuscationEnabled", true),
        serviceWorkerObfuscationEnabled: pickBool("security_serviceWorkerObfuscationEnabled", true),
        inlineCssMinifyEnabled: pickBool("security_inlineCssMinifyEnabled", true),
        publicCssMinifyEnabled: pickBool("security_publicCssMinifyEnabled", true),
      },
      updatedAt: new Date(),
    };

    // หา doc แรก ถ้ามีแล้วก็อัปเดต
    const existing = await secureCol.findOne({});
    if (existing) {
      await secureCol.updateOne(
        { _id: existing._id },
        { $set: doc }
      );
    } else {
      await secureCol.insertOne(doc);
    }

    // รีโหลด config ใน memory (ถ้าใช้)
    if (typeof refreshConfigFromDB === "function") {
      try { await refreshConfigFromDB(); } catch { }
    }

    res.redirect("/admin/settings");
  } catch (err) {
    glog.error("POST /admin/settings/secure error:", err);
    res.status(500).send("บันทึกไม่สำเร็จ");
  }
});

// บันทึกบัญชี topups (dev เท่านั้น)
router.post("/settings/wallets", requireAdmin, async (req, res) => {
  try {
    if (!(await isDevUser(req))) {
      return res.status(403).send("เฉพาะ dev เท่านั้นที่สามารถแก้ไขได้");
    }

    // -------------------- อัปเดต / ลบบัญชีเดิม --------------------
    const raw = req.body.wallets || [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);

    for (const row of list) {
      if (!row || !row.id) continue;

      // ถ้ามี flag _delete ให้ลบบัญชีนี้ออกแล้วข้ามการอัปเดต
      const wantDelete =
        row._delete === "1" ||
        row._delete === "true" ||
        row._delete === "on";

      if (wantDelete) {
        await Topup.findByIdAndDelete(row.id);
        continue;
      }

      const update = {
        accountName: String(row.accountName || "").trim(),
        accountNumber: String(row.accountNumber || "").trim(),
        accountCode: String(row.accountCode || "").trim(),
        secret: String(row.secret || "").trim(),
      };

      // checkbox → boolean
      update.isActive = !!row.isActive;
      update.isSMS = !!row.isSMS;
      update.isAuto = !!row.isAuto;

      // type (DEPOSIT / WITHDRAW)
      if (row.type === "WITHDRAW" || row.type === "DEPOSIT") {
        update.type = row.type;
      }

      await Topup.findByIdAndUpdate(
        row.id,
        { $set: update },
        { new: true }
      );
    }

    // -------------------- เพิ่มบัญชีใหม่ (newWallet) --------------------
    const nw = req.body.newWallet || {};

    const newAccountName = String(nw.accountName || "").trim();
    const newAccountCode = String(nw.accountCode || "").trim();
    const newAccountNumber = String(nw.accountNumber || "").trim();
    const newSecret = String(nw.secret || "").trim();

    // มีข้อมูลครบพอสมควรค่อยสร้าง
    if (newAccountName && newAccountCode && newAccountNumber) {
      const doc = new Topup({
        accountName: newAccountName,
        accountNumber: newAccountNumber,
        accountCode: newAccountCode,
        secret: newSecret,
        type: nw.type === "WITHDRAW" ? "WITHDRAW" : "DEPOSIT",
        isActive: !!nw.isActive,
        isSMS: !!nw.isSMS,
        isAuto: !!nw.isAuto,
      });

      await doc.save();
    }

    res.redirect("/admin/settings");
  } catch (err) {
    glog.error("POST /admin/settings/wallets error:", err);
    res.status(500).send("บันทึกไม่สำเร็จ");
  }
});

router.post('/api/wallet/update-toggle', requireAdmin, async (req, res) => {
  try {
    const canEdit = await isDevUser(req);
    if (!canEdit) {
      return res.status(403).json({ ok: false, message: 'forbidden' });
    }

    const { id, field, value } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      return res.status(400).json({ ok: false, message: 'invalid id' });
    }

    const allowFields = ['isActive', 'isSMS', 'isAuto'];
    if (!allowFields.includes(String(field || ''))) {
      return res.status(400).json({ ok: false, message: 'invalid field' });
    }

    const boolValue =
      value === true ||
      value === 1 ||
      value === '1' ||
      value === 'true' ||
      value === 'on';

    const updated = await Topup.findByIdAndUpdate(
      id,
      { $set: { [field]: boolValue } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ ok: false, message: 'wallet not found' });
    }

    return res.json({
      ok: true,
      wallet: {
        id: String(updated._id),
        isActive: !!updated.isActive,
        isSMS: !!updated.isSMS,
        isAuto: !!updated.isAuto,
      }
    });
  } catch (e) {
    glog.error('toggle error:', e);
    return res.status(500).json({ ok: false, message: e.message || 'toggle failed' });
  }
});

// =====================================================
// 🚫 Bot Block Logs
// GET /admin/security/bot-blocks
// =====================================================
router.get("/security/bot-blocks", requireAdmin, async (req, res) => {
  try {
    const ip = String(req.query.ip || "").trim();
    const path = String(req.query.path || "").trim();
    const rule = String(req.query.rule || "").trim();
    const country = String(req.query.country || "").trim();
    const city = String(req.query.city || "").trim();
    const geoStatus = String(req.query.geoStatus || "").trim();

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;

    const escapeRegex = (value = "") =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const filter = {};

    if (ip) {
      filter.ip = {
        $regex: escapeRegex(ip),
        $options: "i",
      };
    }

    if (path) {
      const pathRx = {
        $regex: escapeRegex(path),
        $options: "i",
      };

      filter.$or = [
        { originalUrl: pathRx },
        { path: pathRx },
        { decodedPath: pathRx },
      ];
    }

    if (rule) {
      filter.rule = rule;
    }

    if (country) {
      const countryRx = {
        $regex: escapeRegex(country),
        $options: "i",
      };

      const countryOr = [
        { country: countryRx },
        { "geo.country": countryRx },
        { "geo.countryCode": countryRx },
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: countryOr }];
        delete filter.$or;
      } else {
        filter.$or = countryOr;
      }
    }

    if (city) {
      filter["geo.city"] = {
        $regex: escapeRegex(city),
        $options: "i",
      };
    }

    if (geoStatus) {
      filter["geo.status"] = geoStatus;
    }

    const now = new Date();

    const activeBlockFilter = {
      status: "active",
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    };

    const [
      rawItems,
      total,
      logHitsAgg,
      blockedHitsAgg,
      activeBlockedTotal,
      blockedIpTotal,
      releasedBlockedTotal,
      rules,
      countries,
      cities,
      geoStatuses,
    ] = await Promise.all([
      BotBlockLog.find(filter)
        .sort({ lastSeenAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      BotBlockLog.countDocuments(filter),

      BotBlockLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            hits: {
              $sum: {
                $ifNull: ["$count", 1],
              },
            },
          },
        },
      ]),

      BotBlockedIp.aggregate([
        {
          $group: {
            _id: null,
            hits: {
              $sum: {
                $ifNull: ["$totalBlockedHits", 0],
              },
            },
          },
        },
      ]),

      BotBlockedIp.countDocuments(activeBlockFilter),
      BotBlockedIp.countDocuments({}),
      BotBlockedIp.countDocuments({ status: "released" }),

      BotBlockLog.distinct("rule"),
      BotBlockLog.distinct("geo.countryCode"),
      BotBlockLog.distinct("geo.city"),
      BotBlockLog.distinct("geo.status"),
    ]);

    const ips = [
      ...new Set(
        (rawItems || [])
          .map((item) => String(item.ip || "").trim())
          .filter(Boolean)
      ),
    ];

    const blockedDocs = ips.length
      ? await BotBlockedIp.find({
          ip: { $in: ips },
          $or: [
            { status: "active" },
            { status: "released" },
          ],
        })
          .select(
            "ip status reason rule samplePath sampleUserAgent bannedAt expiresAt releasedAt releasedBy releaseNote hitCountAtBan totalBlockedHits lastHitAt geo"
          )
          .lean()
      : [];

    const blockedMap = new Map(
      blockedDocs.map((doc) => [String(doc.ip || "").trim(), doc])
    );

    const items = (rawItems || []).map((item) => {
      const itemIp = String(item.ip || "").trim();
      const blocked = blockedMap.get(itemIp) || null;

      const logHitCount = Number(item.count || 1);
      const ipBlockedHits = Number(blocked?.totalBlockedHits || 0);

      const blockedActive =
        blocked?.status === "active" &&
        (
          !blocked?.expiresAt ||
          new Date(blocked.expiresAt).getTime() > Date.now()
        );

      return {
        ...item,

        isBlocked: !!blockedActive,
        blockStatus: blocked?.status || "log_only",

        blockedIp: blocked,
        blockedReason: blocked?.reason || "",
        blockedRule: blocked?.rule || "",
        bannedAt: blocked?.bannedAt || null,
        expiresAt: blocked?.expiresAt || null,
        releasedAt: blocked?.releasedAt || null,
        releasedBy: blocked?.releasedBy || "",
        releaseNote: blocked?.releaseNote || "",

        blockHitCountAtBan: Number(blocked?.hitCountAtBan || 0),
        blockTotalBlockedHits: ipBlockedHits,
        blockLastHitAt: blocked?.lastHitAt || null,

        logHitCount,
        ipBlockedHits,
        combinedHitCount: logHitCount + ipBlockedHits,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));

    const logHits = Number(logHitsAgg?.[0]?.hits || 0);
    const blockedHits = Number(blockedHitsAgg?.[0]?.hits || 0);
    const totalHits = logHits + blockedHits;

    if (req.query.format === "json") {
      return res.json({
        ok: true,
        page,
        limit,
        total,
        totalPages,

        logHits,
        blockedHits,
        totalHits,

        activeBlockedTotal,
        blockedIpTotal,
        releasedBlockedTotal,

        items,
      });
    }

    return res.render("admin/bot-blocks", {
      title: "Bot Block Logs",

      items,
      total,
      page,
      limit,
      totalPages,

      logHits,
      blockedHits,
      totalHits,

      activeBlockedTotal,
      blockedIpTotal,
      releasedBlockedTotal,

      rules: (rules || []).filter(Boolean).sort(),
      countries: (countries || []).filter(Boolean).sort(),
      cities: (cities || []).filter(Boolean).sort(),
      geoStatuses: (geoStatuses || []).filter(Boolean).sort(),

      query: {
        ip,
        path,
        rule,
        country,
        city,
        geoStatus,
      },
    });
  } catch (err) {
    glog.error("[bot-blocks] failed:", err);
    return res.status(500).send(err.message || "failed");
  }
});

// POST /admin/security/bot-blocks/block-ip
// =====================================================
router.post("/security/bot-blocks/block-ip", requireAdmin, async (req, res) => {
  try {
    const ip = String(req.body.ip || "").trim();

    if (!ip) {
      return res.status(400).json({
        ok: false,
        message: "Missing IP",
      });
    }

    const banDays = Math.max(
      1,
      Number(config?.botBlock?.ipBanDays ?? 1)
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + banDays * 24 * 60 * 60 * 1000);

    const latestLog = await BotBlockLog.findOne({ ip })
      .sort({ lastSeenAt: -1, createdAt: -1 })
      .lean();

    await BotBlockedIp.updateOne(
      { ip },
      {
        $setOnInsert: {
          ip,
          bannedAt: now,
        },
        $set: {
          status: "active",
          reason: "manual_admin_block",
          rule: latestLog?.rule || "manual",
          samplePath:
            latestLog?.originalUrl ||
            latestLog?.decodedPath ||
            latestLog?.path ||
            "",
          sampleUserAgent: latestLog?.userAgent || "",
          lastHitAt: latestLog?.lastSeenAt || latestLog?.createdAt || now,
          expiresAt,
          bannedBy: req.user?.username || req.user?.email || "admin",
          ...(latestLog?.geo ? { geo: latestLog.geo } : {}),
        },
        $inc: {
          totalBlockedHits: 1,
        },
      },
      { upsert: true }
    );

    // ล้าง cache เพื่อให้ middleware ไปอ่าน DB ใหม่ทันที
    clearIpCache(ip);

    return res.json({
      ok: true,
      message: "Blocked",
      ip,
      expiresAt,
    });
  } catch (err) {
    glog.error("[manual block ip] failed:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "failed",
    });
  }
});


// =====================================================
// ✅ Release Bot Blocked IP
// POST /admin/security/bot-blocks/release-ip
// =====================================================
router.post("/security/bot-blocks/release-ip", requireAdmin, async (req, res) => {
  try {
    const ip = String(req.body.ip || "").trim();

    if (!ip) {
      return res.status(400).json({
        ok: false,
        message: "Missing IP",
      });
    }

    const result = await BotBlockedIp.updateOne(
      { ip, status: "active" },
      {
        $set: {
          status: "released",
          releasedAt: new Date(),
          releasedBy: req.user?.username || req.user?.email || "admin",
          releaseNote: "manual_release",
        },
      }
    );

    // สำคัญมาก: ล้าง cache ไม่งั้น DB ปลดแล้ว แต่ middleware ยังจำว่าโดนบล็อกอยู่
    clearIpCache(ip);

    return res.json({
      ok: true,
      message: "Released",
      ip,
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0,
    });
  } catch (err) {
    glog.error("[release blocked ip] failed:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "failed",
    });
  }
});

export default router;
