import { Router } from "express";
import mongoose from "mongoose";
import { ulid } from "ulid";
import { User } from "../models/User.js";
import { Topup } from "../models/Topup.js";
import { Transaction } from "../models/Transaction.js";
import { BonustimeOrder } from "../models/BonustimeOrder.js";
import { config, connectMongoIfNeeded, resolveBonustimeDbName } from "../config.js";
import { getNextServiceIdentity } from "../services/bonustimeMultiTenant.js";

const router = Router();
const PRODUCTION_KEY = "rtautobot";
const productionScope = () => ({ production: PRODUCTION_KEY });

const isGlobalLogEnabled = () => config?.system?.globalLogEnabled === true;
const glog = {
  warn: (...args) => { if (isGlobalLogEnabled()) console.warn(...args); },
  error: (...args) => console.error(...args),
};

const METHOD_LABELS = {
  admin: "แอดมิน",
  manual: "เติมมือ",
  truewallet: "TrueMoney Wallet",
  tw: "TrueMoney Wallet",
  kbank: "กสิกรไทย",
  scb: "ไทยพาณิชย์",
  qr: "PromptPay QR",
};

const MANUAL_TOPUP_METHODS = ["admin", "manual", "tw", "qr", "kbank", "scb"];
const REPORT_METHODS = ["all", "tw", "qr", "kbank", "scb", "admin", "manual"];
const methodOptions = () => MANUAL_TOPUP_METHODS.map((value) => ({ value, label: METHOD_LABELS[value] || value }));
const reportMethodOptions = () => REPORT_METHODS.map((value) => ({ value, label: value === "all" ? "ทุกช่องทาง" : (METHOD_LABELS[value] || value) }));

function isObjectId(v) {
  return mongoose.Types.ObjectId.isValid(String(v || ""));
}

function escapeRegExp(v = "") {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getBonustimeUsersCollection() {
  await connectMongoIfNeeded();
  const client = typeof mongoose.connection.getClient === "function"
    ? mongoose.connection.getClient()
    : mongoose.connection.client;
  if (!client) throw new Error("Mongo client is not ready for Bonustime");
  return client.db(resolveBonustimeDbName()).collection("users");
}

function computeLicenseExpiry(doc = {}) {
  if (doc.LICENSE_DISABLED === true) {
    return { expiresAt: null, label: "ไม่มีวันหมดอายุ", input: "", disabled: true };
  }
  const startStr = doc.LICENSE_START_DATE;
  const durDays = Number(doc.LICENSE_DURATION_DAYS || 0);
  const m = String(startStr || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m || !durDays) return { expiresAt: null, label: null, input: "", disabled: false };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const yearBE = Number(m[3]);
  const year = yearBE > 2400 ? yearBE - 543 : yearBE;
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (!Number.isFinite(start.getTime())) return { expiresAt: null, label: null, input: "", disabled: false };
  const expires = new Date(start.getTime() + durDays * 24 * 60 * 60 * 1000);
  return {
    expiresAt: expires,
    label: expires.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "2-digit" }),
    input: expires.toISOString().slice(0, 10),
    disabled: false,
  };
}

function toThaiDate(d = new Date()) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function normalizeMonthly(orders = []) {
  let totalRevenue = 0;
  let pkg1Revenue = 0;
  let pkg2Revenue = 0;
  let pkg1Count = 0;
  let pkg2Count = 0;
  const dailyMap = {};

  for (const o of orders) {
    const amt = Number(o.amountTHB || 0) || 0;
    const created = new Date(o.createdAt || Date.now());
    const day = created.getUTCDate();
    if (!dailyMap[day]) dailyMap[day] = { day, pkg1: 0, pkg2: 0, total: 0, count: 0 };
    const type = String(o.packageType || "").toLowerCase();
    const isPkg2 = ["lotto", "pack2", "package2"].includes(type);
    if (isPkg2) {
      pkg2Revenue += amt;
      pkg2Count++;
      dailyMap[day].pkg2 += amt;
    } else {
      pkg1Revenue += amt;
      pkg1Count++;
      dailyMap[day].pkg1 += amt;
    }
    totalRevenue += amt;
    dailyMap[day].total += amt;
    dailyMap[day].count += 1;
  }

  const daily = Object.values(dailyMap).sort((a, b) => a.day - b.day);
  const top5 = [...daily]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((d) => ({ day: d.day, amount: d.total }));

  return {
    totalRevenue,
    pkg1Revenue,
    pkg2Revenue,
    pkg1Count,
    pkg2Count,
    orderCount: orders.length,
    daily,
    top5,
    pkg1Data: daily.map((d) => d.pkg1),
    pkg2Data: daily.map((d) => d.pkg2),
    totalData: daily.map((d) => d.total),
  };
}

function normalizeYearly(orders = []) {
  let totalRevenue = 0;
  let pkg1Revenue = 0;
  let pkg2Revenue = 0;
  let pkg1Count = 0;
  let pkg2Count = 0;
  const monthMap = {};

  for (const o of orders) {
    const amt = Number(o.amountTHB || 0) || 0;
    const created = new Date(o.createdAt || Date.now());
    const month = created.getUTCMonth() + 1;
    if (!monthMap[month]) monthMap[month] = { month, pkg1: 0, pkg2: 0, total: 0, count: 0 };
    const type = String(o.packageType || "").toLowerCase();
    const isPkg2 = ["lotto", "pack2", "package2"].includes(type);
    if (isPkg2) {
      pkg2Revenue += amt;
      pkg2Count++;
      monthMap[month].pkg2 += amt;
    } else {
      pkg1Revenue += amt;
      pkg1Count++;
      monthMap[month].pkg1 += amt;
    }
    totalRevenue += amt;
    monthMap[month].total += amt;
    monthMap[month].count += 1;
  }

  const monthly = Array.from({ length: 12 }, (_, i) => monthMap[i + 1] || { month: i + 1, pkg1: 0, pkg2: 0, total: 0, count: 0 });
  const bestMonth = [...monthly].sort((a, b) => b.total - a.total)[0] || { month: 1, total: 0, count: 0 };

  return {
    yearlyTotalRevenue: totalRevenue,
    yearlyPkg1Revenue: pkg1Revenue,
    yearlyPkg2Revenue: pkg2Revenue,
    yearlyPkg1Count: pkg1Count,
    yearlyPkg2Count: pkg2Count,
    yearlyOrderCount: orders.length,
    yearlyMonthly: monthly,
    yearlyBestMonth: bestMonth,
  };
}

function yearRange(year) {
  const now = new Date();
  let y = now.getUTCFullYear();
  const n = Number(year);
  if (Number.isFinite(n) && n >= 2000 && n <= 3000) y = n;
  return {
    year: y,
    start: new Date(Date.UTC(y, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0)),
  };
}

function monthRange(month) {
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
    const [yy, mm] = month.split("-").map(Number);
    if (yy && mm >= 1 && mm <= 12) { y = yy; m = mm; }
  }
  return {
    month: `${y}-${String(m).padStart(2, "0")}`,
    start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, 1, 0, 0, 0)),
  };
}

function getBangkokMonthRange(yy, mm) {
  const start = new Date(Date.UTC(yy, mm - 1, 1, -7, 0, 0));
  const end = new Date(Date.UTC(yy, mm, 1, -7, 0, 0));
  return { start, end };
}

function getBangkokYearRange(yy) {
  const start = new Date(Date.UTC(yy, 0, 1, -7, 0, 0));
  const end = new Date(Date.UTC(yy + 1, 0, 1, -7, 0, 0));
  return { start, end };
}

router.get("/", async (_req, res) => {
  try {
    const bonustimeCol = await getBonustimeUsersCollection();
    const [serviceCount, activeServiceDocs, walletCount, topupAgg, orderAgg, pendingTransactions] = await Promise.all([
      bonustimeCol.countDocuments({}),
      bonustimeCol.find({
        serial_key: { $exists: true, $nin: [null, ""] },
        LICENSE_DISABLED: { $ne: true },
      }).project({ LICENSE_START_DATE: 1, LICENSE_DURATION_DAYS: 1, LICENSE_DISABLED: 1, serial_key: 1, LOTTO_ENABLED: 1 }).toArray(),
      Topup.countDocuments({ ...productionScope(), type: "DEPOSIT" }),
      Transaction.aggregate([
        { $match: { ...productionScope(), status: "completed", method: { $ne: "admin" } } },
        { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      BonustimeOrder.aggregate([
        { $group: { _id: null, sum: { $sum: "$amountTHB" }, count: { $sum: 1 } } },
      ]),
      Transaction.find({ ...productionScope(), status: "pending" })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate({ path: "userId", select: "username email avatarUrl avatarVer" })
        .lean(),
    ]);

    const now = new Date();
    const activeServiceCount = (activeServiceDocs || []).filter((doc) => {
      const expiry = computeLicenseExpiry(doc);
      // ไม่นับ Service ที่ตั้งเป็นไม่มีวันหมดอายุ ตามเงื่อนไขหน้า dashboard
      if (expiry.disabled || !expiry.expiresAt) return false;
      return expiry.expiresAt.getTime() > now.getTime();
    }).length;

    const pendingTotal = (pendingTransactions || []).reduce((sum, tx) => sum + (Number(tx.amount || 0) || 0), 0);

    res.render("admin/dashboard", {
      title: "Admin | RTAUTOBOT",
      pageTitle: "Admin | RTAUTOBOT",
      pendingTransactions: pendingTransactions || [],
      methodLabels: METHOD_LABELS,
      methodOptions: methodOptions(),
      stats: {
        serviceCount,
        walletCount,
        activeServiceCount,
        pendingCount: pendingTransactions?.length || 0,
        pendingTotal,
        topupSum: topupAgg?.[0]?.sum || 0,
        topupCount: topupAgg?.[0]?.count || 0,
        bonustimeRevenue: orderAgg?.[0]?.sum || 0,
        bonustimeOrderCount: orderAgg?.[0]?.count || 0,
      },
    });
  } catch (err) {
    glog.error("GET /admin error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการโหลดหน้าแอดมิน");
  }
});

router.get("/settings", async (_req, res) => {
  try {
    const wallets = await Topup.find({ ...productionScope() })
      .sort({ type: 1, accountCode: 1, createdAt: 1 })
      .lean();
    res.render("admin/admin_setting", {
      title: "ตั้งค่าบัญชีรับเงิน | RTAUTOBOT",
      pageTitle: "ตั้งค่าบัญชีรับเงิน | RTAUTOBOT",
      wallets,
      productionKey: PRODUCTION_KEY,
      canEdit: true,
    });
  } catch (err) {
    glog.error("GET /admin/settings error:", err);
    res.status(500).send("เกิดข้อผิดพลาดในการโหลดการตั้งค่าบัญชี");
  }
});

router.post("/settings/wallets", async (req, res) => {
  try {
    const raw = req.body.wallets || [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);

    for (const row of list) {
      if (!row?.id || !isObjectId(row.id)) continue;
      const wantDelete = ["1", "true", "on", true].includes(row._delete);
      const query = { _id: row.id, ...productionScope() };
      if (wantDelete) {
        await Topup.deleteOne(query);
        continue;
      }
      const update = {
        ...productionScope(),
        accountName: String(row.accountName || "").trim(),
        accountNumber: String(row.accountNumber || "").trim(),
        accountCode: String(row.accountCode || "").trim().toLowerCase(),
        secret: String(row.secret || "").trim(),
        type: String(row.type || "DEPOSIT").trim().toUpperCase() === "WITHDRAW" ? "WITHDRAW" : "DEPOSIT",
        isActive: !!row.isActive,
        isSMS: !!row.isSMS,
        isAuto: !!row.isAuto,
      };
      await Topup.updateOne(query, { $set: update });
    }

    const nw = req.body.newWallet || {};
    const newAccountName = String(nw.accountName || "").trim();
    const newAccountCode = String(nw.accountCode || "").trim().toLowerCase();
    const newAccountNumber = String(nw.accountNumber || "").trim();
    const newSecret = String(nw.secret || "").trim();

    if (newAccountName && newAccountCode && newAccountNumber) {
      await Topup.create({
        ...productionScope(),
        accountName: newAccountName,
        accountNumber: newAccountNumber,
        accountCode: newAccountCode,
        secret: newSecret,
        type: String(nw.type || "DEPOSIT").trim().toUpperCase() === "WITHDRAW" ? "WITHDRAW" : "DEPOSIT",
        isActive: !!nw.isActive,
        isSMS: !!nw.isSMS,
        isAuto: !!nw.isAuto,
      });
    }

    res.redirect("/admin/settings");
  } catch (err) {
    glog.error("POST /admin/settings/wallets error:", err);
    res.status(500).send("บันทึกบัญชีรับเงินไม่สำเร็จ");
  }
});

router.post("/api/wallet/update-toggle", async (req, res) => {
  try {
    const { id, field, value } = req.body || {};
    const allowed = new Set(["isActive", "isSMS", "isAuto"]);
    if (!isObjectId(id) || !allowed.has(field)) return res.status(400).json({ ok: false, message: "ข้อมูลไม่ถูกต้อง" });
    const wallet = await Topup.findOneAndUpdate(
      { _id: id, ...productionScope() },
      { $set: { [field]: value === true || value === "true" || value === "1" } },
      { new: true }
    ).lean();
    if (!wallet) return res.status(404).json({ ok: false, message: "ไม่พบบัญชีรับเงิน" });
    return res.json({ ok: true, wallet });
  } catch (err) {
    glog.error("POST /admin/api/wallet/update-toggle error:", err);
    return res.status(500).json({ ok: false, message: "บันทึกไม่สำเร็จ" });
  }
});

router.get("/api/users/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
    const cond = q ? { username: { $regex: escapeRegExp(q), $options: "i" } } : {};
    const items = await User.find(cond)
      .select("_id username email role balance points")
      .sort({ username: 1 })
      .limit(limit)
      .lean();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  }
});

router.post("/manual-topup", async (req, res) => {
  try {
    let { username, amount, txId, method } = req.body || {};
    if (!username || amount === undefined || amount === null) {
      return res.json({ ok: false, error: "ข้อมูลไม่ครบ" });
    }
    const amt = Math.round(Number(String(amount).replace(/,/g, "")) * 100) / 100;
    if (!(amt > 0)) return res.json({ ok: false, error: "จำนวนเงินไม่ถูกต้อง" });
    const amtCents = Math.round(amt * 100);

    let m = String(method || "admin").toLowerCase();
    if (m === "truewallet") m = "tw";
    if (!MANUAL_TOPUP_METHODS.includes(m)) m = "admin";

    const user = await User.findOne({ username });
    if (!user) return res.json({ ok: false, error: "ไม่พบผู้ใช้" });

    user.balance = Number(user.balance || 0) + amt;
    await user.save();

    const now = new Date();
    if (txId) {
      await Transaction.findOneAndUpdate(
        { transactionId: txId, ...productionScope() },
        {
          $set: {
            ...productionScope(),
            userId: user._id,
            username: user.username,
            method: m,
            amount: amt,
            amountCents: amtCents,
            currency: "THB",
            status: "completed",
            updatedAt: now,
            paidAt: now,
            note: "manual topup by admin",
          },
          $setOnInsert: { transactionId: txId, createdAt: now },
        },
        { new: true, upsert: true }
      );
    } else {
      await Transaction.create({
        ...productionScope(),
        transactionId: ulid(),
        userId: user._id,
        username: user.username,
        method: m,
        amount: amt,
        amountCents: amtCents,
        currency: "THB",
        status: "completed",
        createdAt: now,
        updatedAt: now,
        paidAt: now,
        note: "manual topup by admin",
      });
    }

    return res.json({ ok: true, username, amount: amt, method: m, balance: user.balance });
  } catch (err) {
    glog.error("admin manual topup error:", err);
    return res.json({ ok: false, error: "เกิดข้อผิดพลาดในระบบ" });
  }
});

router.post("/topup/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const tx = isObjectId(id)
      ? await Transaction.findOne({ _id: id, ...productionScope() })
      : await Transaction.findOne({ transactionId: id, ...productionScope() });
    if (!tx) return res.status(404).json({ ok: false, error: "ไม่พบรายการ" });
    if (tx.status !== "pending") {
      return res.status(400).json({ ok: false, error: `สถานะปัจจุบันคือ "${tx.status}" ไม่สามารถปฏิเสธได้` });
    }
    tx.status = "reject";
    tx.rejectedAt = new Date();
    tx.rejectedBy = req.user?._id ?? null;
    tx.note = [tx.note, "rejected by admin"].filter(Boolean).join(" | ");
    await tx.save();
    return res.json({ ok: true });
  } catch (err) {
    glog.error("reject tx error:", err);
    return res.status(500).json({ ok: false, error: "เซิร์ฟเวอร์มีปัญหา" });
  }
});

router.get("/topup-report", async (req, res) => {
  try {
    const now = new Date();
    const reportMode = String(req.query.mode || "month").toLowerCase() === "year" ? "year" : "month";
    const rawMonth = String(req.query.month || "").slice(0, 7);
    const [yy, mm] = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth.split("-").map(Number)
      : [now.getFullYear(), now.getMonth() + 1];
    const selectedYearRaw = Number(req.query.year);
    const selectedYear = Number.isFinite(selectedYearRaw) && selectedYearRaw >= 2000 && selectedYearRaw <= 3000
      ? selectedYearRaw
      : yy;

    const monthStr = `${yy}-${String(mm).padStart(2, "0")}`;
    const monthDateRange = getBangkokMonthRange(yy, mm);
    const yearDateRange = getBangkokYearRange(selectedYear);
    const activeRange = reportMode === "year" ? yearDateRange : monthDateRange;
    // RTAUTOBOT topup report must show every payment Method in the selected period.
    // Do not filter by method here; method breakdown is displayed inside the report rows/cards.
    const activeMatch = { ...productionScope(), createdAt: { $gte: activeRange.start, $lt: activeRange.end } };

    const transactions = await Transaction.find(activeMatch)
      .sort({ createdAt: -1 })
      .populate({ path: "userId", select: "username email avatarUrl avatarVer" })
      .lean();

    const [aggNoAdmin, aggByMethod, aggCompleted, yearlyAgg, yearlyMethodAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...activeMatch, status: "completed", method: { $ne: "admin" } } },
        { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { ...activeMatch, status: "completed" } },
        { $group: { _id: "$method", sum: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { ...activeMatch, status: "completed" } },
        { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { ...productionScope(), createdAt: { $gte: yearDateRange.start, $lt: yearDateRange.end }, status: "completed" } },
        { $group: { _id: { month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Bangkok" } }, method: "$method" }, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { "_id.month": 1 } },
      ]),
      Transaction.aggregate([
        { $match: { ...productionScope(), createdAt: { $gte: yearDateRange.start, $lt: yearDateRange.end }, status: "completed" } },
        { $group: { _id: { month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "Asia/Bangkok" } }, method: "$method" }, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { "_id.month": 1 } },
      ]),
    ]);

    const methodTotals = (aggByMethod || [])
      .map((m) => ({
        method: String(m._id || "").toLowerCase(),
        label: METHOD_LABELS[String(m._id || "").toLowerCase()] || (m._id || "ไม่ระบุ"),
        sum: m.sum || 0,
        count: m.count || 0,
      }))
      .filter((m) => m.count > 0);

    const yearlyMonthMap = new Map();
    for (const r of yearlyAgg || []) {
      const key = r._id?.month;
      if (!key) continue;
      const row = yearlyMonthMap.get(key) || { sum: 0, count: 0, noAdminSum: 0, noAdminCount: 0, methods: [] };
      const method = String(r._id?.method || "").toLowerCase();
      row.sum += Number(r.sum || 0);
      row.count += Number(r.count || 0);
      if (method !== "admin") {
        row.noAdminSum += Number(r.sum || 0);
        row.noAdminCount += Number(r.count || 0);
      }
      row.methods.push({ method, label: METHOD_LABELS[method] || method || "ไม่ระบุ", sum: r.sum || 0, count: r.count || 0 });
      yearlyMonthMap.set(key, row);
    }

    const yearlyRows = Array.from({ length: 12 }, (_, i) => {
      const key = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
      const row = yearlyMonthMap.get(key) || { sum: 0, count: 0, noAdminSum: 0, noAdminCount: 0, methods: [] };
      return {
        month: key,
        label: new Date(Date.UTC(selectedYear, i, 1)).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" }),
        ...row,
      };
    });

    res.render("admin/topup-report", {
      transactions,
      monthStr,
      selectedYear,
      reportMode,
      selectedLabel: reportMode === "year" ? String(selectedYear) : monthStr,
      yearlyRows,
      sumNoAdmin: aggNoAdmin?.[0]?.sum || 0,
      countNoAdmin: aggNoAdmin?.[0]?.count || 0,
      methodTotals,
      sumCompleted: aggCompleted?.[0]?.sum || 0,
      countCompleted: aggCompleted?.[0]?.count || 0,
      methodOptions: methodOptions(),
    });
  } catch (err) {
    glog.error("GET /admin/topup-report error:", err);
    res.status(500).send("โหลดรายงานเติมเงินไม่สำเร็จ");
  }
});

router.get("/bonustime-panel", async (_req, res) => {
  try {
    const col = await getBonustimeUsersCollection();
    const docs = await col.find({}).sort({ createdAt: 1, _id: 1 }).toArray();
    const serialKeys = docs.map((d) => d.serial_key).filter(Boolean);

    const ownerBySerial = {};
    const ownerDisplayBySerial = {};
    if (serialKeys.length) {
      try {
        const users = await User.find({ serial_key: { $in: serialKeys } }).select("username name serial_key").lean();
        for (const u of users || []) {
          ownerBySerial[u.serial_key] = u.username || "";
          ownerDisplayBySerial[u.serial_key] = u.name || u.username || "";
        }
      } catch (err) {
        glog.warn("Owner map error:", err?.message || err);
      }
    }

    const records = docs.map((doc) => ({
      tenantId: doc.tenantId || doc.serviceKey || "",
      legacyTenantId: doc.legacyTenantId || "",
      serviceMode: doc.serviceMode || "multiTenant",
      serviceGroup: doc.serviceGroup || "",
      serviceNo: doc.serviceNo || null,
      serviceKey: doc.serviceKey || doc.tenantId || "",
      webhookUrl: doc.webhookUrl || doc.LINK || "",
      LINK: doc.LINK || doc.webhookUrl || "",
      serial_key: doc.serial_key || "",
      username: ownerBySerial[doc.serial_key] || "",
      ownerName: doc.ownerName || ownerDisplayBySerial[doc.serial_key] || "",
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
      expiry: computeLicenseExpiry(doc),
      expiresAt: computeLicenseExpiry(doc).expiresAt,
      expiresAtLabel: computeLicenseExpiry(doc).label,
      expiresAtInput: computeLicenseExpiry(doc).input,
      licenseDisabled: computeLicenseExpiry(doc).disabled,
      note: doc.note || "",
    }));

    const { start, end } = monthRange();
    const currentYearRange = yearRange();
    const [monthOrders, yearOrders] = await Promise.all([
      BonustimeOrder.find({ createdAt: { $gte: start, $lt: end } }).lean(),
      BonustimeOrder.find({ createdAt: { $gte: currentYearRange.start, $lt: currentYearRange.end } }).lean(),
    ]);
    const monthly = normalizeMonthly(monthOrders);
    const yearly = normalizeYearly(yearOrders);

    return res.render("admin/bonustime_panel", {
      title: "Bonustime Panel",
      pageTitle: "Bonustime Panel | RTAUTOBOT",
      records,
      updateEndpoint: "/admin/bonustime/tenant",
      currentYear: currentYearRange.year,
      ...monthly,
      ...yearly,
    });
  } catch (err) {
    glog.error("GET /admin/bonustime-panel error:", err);
    return res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูล Bonustime");
  }
});

router.get("/bonustime/yearly.json", async (req, res) => {
  try {
    const range = yearRange(req.query.year);
    const orders = await BonustimeOrder.find({ createdAt: { $gte: range.start, $lt: range.end } }).lean();
    const yearly = normalizeYearly(orders);
    return res.json({ ok: true, year: range.year, ...yearly });
  } catch (err) {
    glog.error("GET /admin/bonustime/yearly.json error:", err);
    return res.status(500).json({ ok: false, error: "server-error" });
  }
});

router.get("/bonustime/monthly.json", async (req, res) => {
  try {
    const range = monthRange(req.query.month);
    const orders = await BonustimeOrder.find({ createdAt: { $gte: range.start, $lt: range.end } }).lean();
    const monthly = normalizeMonthly(orders);
    return res.json({ ok: true, month: range.month, ...monthly, totalMonth: monthly.totalRevenue, pkg1Month: monthly.pkg1Revenue, pkg2Month: monthly.pkg2Revenue });
  } catch (err) {
    glog.error("GET /admin/bonustime/monthly.json error:", err);
    return res.status(500).json({ ok: false, error: "server-error" });
  }
});

router.patch("/bonustime/tenant/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { field, value } = req.body || {};
    const allowed = new Set([
      "NAME", "LOGO", "LOGIN_URL", "SIGNUP_URL", "LINE_ADMIN",
      "LOTTO_ENABLED", "LICENSE_START_DATE", "LICENSE_DURATION_DAYS", "LICENSE_DISABLED",
      "CHANNEL_ACCESS_TOKEN", "CHANNEL_SECRET", "serial_key", "ownerName", "note",
    ]);
    if (!tenantId || !allowed.has(field)) return res.status(400).json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" });

    let v = value;
    if (["LOTTO_ENABLED", "LICENSE_DISABLED"].includes(field)) v = value === true || value === "true" || value === "1";
    if (field === "LICENSE_DURATION_DAYS") v = Math.max(0, Number(value || 0));

    const col = await getBonustimeUsersCollection();
    const result = await col.updateOne(
      { $or: [{ tenantId }, { serviceKey: tenantId }] },
      { $set: { [field]: v, updatedAt: new Date() } }
    );
    if (!result.matchedCount) return res.status(404).json({ ok: false, error: "ไม่พบ Service นี้" });
    return res.json({ ok: true, updated: true });
  } catch (err) {
    glog.error("PATCH /admin/bonustime/tenant error:", err);
    return res.status(500).json({ ok: false, error: "บันทึกไม่สำเร็จ" });
  }
});

router.post("/bonustime/tenant", async (req, res) => {
  try {
    const wantLotto = req.body?.LOTTO_ENABLED === true || req.body?.LOTTO_ENABLED === "true" || req.body?.LOTTO_ENABLED === "1";
    const col = await getBonustimeUsersCollection();
    const identity = await getNextServiceIdentity(col, wantLotto);
    const now = new Date();
    const doc = {
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
      LOGIN_URL: "https://rtautobot.com/bonustime",
      SIGNUP_URL: "https://rtautobot.com/bonustime",
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
    return res.json({ ok: true, insertedId: result.insertedId, serviceKey: identity.serviceKey, webhookUrl: identity.webhookUrl });
  } catch (err) {
    glog.error("POST /admin/bonustime/tenant error:", err);
    return res.status(500).json({ ok: false, error: "สร้างรายการไม่สำเร็จ" });
  }
});

router.delete("/bonustime/tenant/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const col = await getBonustimeUsersCollection();
    const result = await col.deleteOne({ $or: [{ tenantId }, { serviceKey: tenantId }] });
    if (!result.deletedCount) return res.status(404).json({ ok: false, error: "ไม่พบ Service นี้" });
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    glog.error("DELETE /admin/bonustime/tenant error:", err);
    return res.status(500).json({ ok: false, error: "ลบไม่สำเร็จ" });
  }
});

export default router;
