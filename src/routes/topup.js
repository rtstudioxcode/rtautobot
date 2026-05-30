// routes/topup.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import axios from "axios";
import { jwtVerify } from "jose";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import { getAuthUserId } from "../lib/auth.js";
import { User } from "../models/User.js";
import { Topup } from "../models/Topup.js";
import { Transaction } from "../models/Transaction.js";
import { config } from "../config.js";

export const topupRouter = express.Router();
export const topupPublicRouter = express.Router();

// =========================
// 🔥 GLOBAL LOG CONTROL
// =========================
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

// =========================
// 🔥 RATE LIMIT
// =========================
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
});

// =========================
// 🧠 TIME HELPER
// =========================
const BANGKOK_TZ_OFFSET_MIN = 7 * 60;

function makeBangkokDateFromParts(year, month, day, hour, minute, second = 0) {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utcMs - BANGKOK_TZ_OFFSET_MIN * 60 * 1000);
}

// =========================
// 💰 TOPUP AMOUNT HELPER
// เศษไม่เกิน .20 ทุก method
// =========================
const TOPUP_ALLOWED_METHODS = ["tw", "qr", "kbank", "scb"];

function normalizeTopupMethod(value) {
  const method = String(value || "").toLowerCase().trim();
  return TOPUP_ALLOWED_METHODS.includes(method) ? method : "";
}

function secondsUntil(date, fallback = 15 * 60) {
  const ms = date ? new Date(date).getTime() - Date.now() : fallback * 1000;
  if (!Number.isFinite(ms)) return fallback;
  return Math.max(1, Math.ceil(ms / 1000));
}

// =========================
// ⏳ TOPUP EXPIRE HELPER
// =========================
// TW / PromptPay QR: 5 นาที
// ธนาคาร SMS เช่น KBANK / SCB: 15 นาที
function getTopupExpireSeconds(method) {
  const m = normalizeTopupMethod(method);

  if (m === "tw" || m === "qr") {
    return 5 * 60;
  }

  if (m === "kbank" || m === "scb") {
    return 15 * 60;
  }

  return 5 * 60;
}

function getTopupExpireMinutes(method) {
  return Math.ceil(getTopupExpireSeconds(method) / 60);
}

async function resolveRequestedTopupMethod(body = {}) {
  // ✅ รองรับชื่อ field จาก frontend ทุกเวอร์ชัน
  // - method
  // - accountCode
  // - walletCode (ตัวที่หน้า EJS ใช้อยู่)
  const raw = body.method || body.accountCode || body.walletCode || body.channel || "";
  let method = normalizeTopupMethod(raw);

  if (method) {
    const active = await Topup.exists({
      accountCode: method,
      isActive: true,
      ...(method === "tw" ? { isSMS: false } : {}),
    });

    if (!active) {
      const err = new Error(`ช่องทางเติมเงิน ${method.toUpperCase()} ยังไม่เปิดใช้งาน`);
      err.statusCode = 400;
      throw err;
    }

    return method;
  }

  // ✅ กันเคส frontend ไม่ส่ง method มาเลย:
  // ถ้าเปิด active แค่ช่องทางเดียว ให้ใช้ช่องทางนั้นแทนการ fallback เป็น qr
  const activeWallets = await Topup.find({
    isActive: true,
    accountCode: { $in: TOPUP_ALLOWED_METHODS },
  })
    .select("accountCode isSMS")
    .lean();

  const methods = [...new Set(
    activeWallets
      .filter((w) => w.accountCode !== "tw" || w.isSMS === false)
      .map((w) => normalizeTopupMethod(w.accountCode))
      .filter(Boolean)
  )];

  if (methods.length === 1) return methods[0];

  // fallback สุดท้ายเพื่อเข้ากันได้กับระบบเดิม
  return "qr";
}

async function cleanupExpiredProcessingTransactions() {
  // ✅ กันรายการค้าง processing เฉพาะรายการ orphan/no-user เท่านั้น
  // ห้าม fail/cancel รายการที่ผู้ใช้สร้างเอง แม้ expiresAt จะหมดแล้ว
  await Transaction.updateMany(
    {
      status: "processing",
      expiresAt: { $lte: new Date() },
      $or: [
        { userId: { $exists: false } },
        { userId: null },
      ],
    },
    {
      $set: {
        status: "failed",
        note: "expired processing orphan topup",
      },
    }
  );
}

function buildPendingTopupMatchFilter(method, amountCents) {
  // ✅ รายการที่มี userId: จับคู่ได้แม้หมดเวลา เพื่อไม่ให้เงินผู้ใช้หลุดหลัง countdown จบ
  // ✅ รายการที่ไม่มี userId: จับคู่เฉพาะที่ยังไม่หมดเวลา/ไม่มี expiresAt เท่านั้น
  return {
    method,
    amountCents,
    status: "pending",
    $or: [
      { userId: { $exists: true, $ne: null } },
      {
        $and: [
          { $or: [{ userId: { $exists: false } }, { userId: null }] },
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
        ],
      },
    ],
  };
}

function setNoStore(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
}

function normalizeDirectAmountToCents(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function normalizeJwtSatangToCents(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  // TrueWallet JWT webhook เดิมส่งเป็นสตางค์ เช่น 1001 = 10.01
  return Math.round(n);
}

function payloadToObject(input) {
  if (!input) return {};
  if (Buffer.isBuffer(input)) input = input.toString('utf8');
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...parsed, __rawText: raw };
    } catch {}
    return { message: raw, text: raw, __rawText: raw };
  }
  if (typeof input === 'object') return input;
  return {};
}

function cleanBearer(value) {
  const v = String(value || '').trim();
  return v.replace(/^Bearer\s+/i, '').trim();
}

function readWebhookSecret(req, body = {}) {
  return String(
    body.secret || body.webhookSecret || body.key || body.tokenSecret ||
    req.get?.('x-webhook-secret') || req.get?.('x-topup-secret') || ''
  ).trim();
}

function readWebhookMessage(req, body = {}) {
  const auth = cleanBearer(req.get?.('authorization'));
  return body.message || body.token || body.jwt || body.data || body.payload || auth || body.__rawText || '';
}

function getClientIp(req) {
  const forwarded = String(req.get?.("x-forwarded-for") || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "";
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function parseNotificationAmount(text = "") {
  const raw = String(text || "");
  const patterns = [
    /(?:ยอดเงินจำนวน|จำนวน|ฝาก|รับโอน|เงินเข้า|โอนเข้า|ได้รับเงิน|เข้า)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)\s*(?:บาท|บ\.?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)\s*(?:บาท|บ\.?)/i,
  ];

  for (const rx of patterns) {
    const m = raw.match(rx);
    if (!m) continue;
    const n = Number(String(m[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function normalizeMacrodroidPayload(req) {
  const payload = payloadToObject(req.body || {});
  const notificationText = firstNonEmpty(
    payload.notification_text,
    payload.notificationText,
    payload.text,
    payload.message,
    payload.notification,
    payload.bigText,
    payload.notification_big_text,
    payload.__rawText
  );
  const title = firstNonEmpty(
    payload.notification_title,
    payload.notificationTitle,
    payload.title,
    payload.not_title,
    payload.app
  );
  const appName = firstNonEmpty(
    payload.notification_app_name,
    payload.notificationAppName,
    payload.appName,
    payload.packageName,
    payload.source
  );
  const combinedText = [title, notificationText].filter(Boolean).join("\n");

  return {
    payload,
    appName,
    title,
    text: notificationText,
    combinedText,
    amount: parseNotificationAmount(combinedText),
    device: firstNonEmpty(payload.device, payload.deviceId, payload.phone, payload.phoneName),
    eventTimeText: firstNonEmpty(payload.time, payload.system_time, payload.notification_time, payload.receivedAt),
  };
}

async function isValidMacrodroidTestSecret(secret = "") {
  const value = String(secret || "").trim();
  if (!value) return false;

  const envToken = String(process.env.MACRODROID_TEST_TOKEN || process.env.MACRODROID_TOKEN || "").trim();
  if (envToken && value === envToken) return true;

  const topup = await Topup.findOne({
    isActive: true,
    secret: value,
    accountCode: { $in: ["kbank", "scb", "tw", "qr"] },
  }).select("_id accountCode").lean();

  return !!topup;
}

async function handleMacrodroidTestWebhook(req, res) {
  try {
    // TEST ONLY: ไม่ตรวจ token/secret เพื่อให้ตั้งค่า MacroDroid ได้ง่าย
    // หลังทดสอบสำเร็จค่อยเพิ่ม MACRODROID_TEST_TOKEN หรือผูกกับ Topup.secret อีกครั้ง
    const normalized = normalizeMacrodroidPayload(req);
    const now = new Date();

    const doc = {
      provider: "macrodroid-test",
      source: firstNonEmpty(normalized.appName, normalized.payload.source, "unknown"),
      channel: firstNonEmpty(normalized.payload.channel, "notification"),
      title: normalized.title,
      text: normalized.text,
      combinedText: normalized.combinedText,
      amount: normalized.amount,
      device: normalized.device,
      eventTimeText: normalized.eventTimeText,
      rawBody: normalized.payload,
      meta: {
        ip: getClientIp(req),
        userAgent: req.get?.("user-agent") || "",
        contentType: req.get?.("content-type") || "",
      },
      used: false,
      processed: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await mongoose.connection.collection("macrodroid_test_inbox").insertOne(doc);

    return res.json({
      success: true,
      stored: true,
      collection: "macrodroid_test_inbox",
      id: String(result.insertedId),
      parsed: {
        source: doc.source,
        title: doc.title,
        text: doc.text,
        amount: doc.amount,
      },
    });
  } catch (e) {
    glog.error("MACRODROID TEST WEBHOOK ERROR", e);
    return res.status(500).json({ success: false, message: "server error" });
  }
}

async function parseTrueWalletWebhookBody(rawBody = {}, topup, req = null) {
  const body = payloadToObject(rawBody);
  const message = readWebhookMessage(req || { get: () => "" }, body);

  if (message) {
    const secret = new TextEncoder().encode(String(topup.secret || "").trim());
    const { payload } = await jwtVerify(String(message), secret);
    const amountCents = normalizeJwtSatangToCents(
      payload.amount ?? payload.transfer_amount ?? payload.received_amount
    );

    return {
      ok: amountCents > 0,
      mode: "jwt",
      amountCents,
      rawAmount: amountCents / 100,
      payload,
      rawMessage: String(message),
    };
  }

  // ✅ รองรับ webhook/provider ที่ส่ง amount ตรง ๆ แต่ต้องมี secret ตรงกับ DB
  const givenSecret = readWebhookSecret(req || { get: () => "" }, body);
  if (!givenSecret || String(givenSecret).trim() !== String(topup.secret || "").trim()) {
    return { ok: false, mode: "missing_or_invalid_secret" };
  }

  const amountCents = normalizeDirectAmountToCents(
    body.amount ?? body.payAmount ?? body.total ?? body.value
  );

  return {
    ok: amountCents > 0,
    mode: "direct",
    amountCents,
    rawAmount: amountCents / 100,
    payload: body,
    rawMessage: JSON.stringify(body),
  };
}

async function handleTrueWalletWebhook(req, res) {
  try {
    const topup = await Topup.findOne({
      accountCode: "tw",
      isActive: true,
      isSMS: false,
    }).lean();

    if (!topup?.secret) {
      glog.warn("TW WEBHOOK NO ACTIVE TOPUP OR SECRET");
      return res.status(401).json({ success: false, message: "TW secret not configured" });
    }

    await cleanupExpiredProcessingTransactions();

    let parsed;
    try {
      parsed = await parseTrueWalletWebhookBody(req.body || {}, topup, req);
    } catch (err) {
      glog.warn("TW WEBHOOK VERIFY FAILED", err?.message);
      return res.status(401).json({ success: false, message: "invalid webhook signature" });
    }

    if (!parsed?.ok || !parsed.amountCents) {
      glog.warn("TW WEBHOOK NO AMOUNT", {
        mode: parsed?.mode,
        bodyKeys: Object.keys(payloadToObject(req.body || {})),
      });
      return res.status(400).json({ success: false, message: "amount not found" });
    }

    const addedCents = parsed.amountCents;
    const rawAmount = addedCents / 100;

    glog.info("TW WEBHOOK RECEIVED", {
      amount: rawAmount,
      amountCents: addedCents,
      mode: parsed.mode,
      ip: req.ip,
    });

    // 🔥 DEDUPE ±2 นาที
    const dup = await Transaction.findOne({
      method: "tw",
      amountCents: addedCents,
      status: "completed",
      occurredAt: {
        $gte: new Date(Date.now() - 2 * 60 * 1000),
        $lte: new Date(Date.now() + 2 * 60 * 1000),
      },
    }).lean();

    if (dup) return res.json({ success: true, deduped: true });

    // 🔥 ATOMIC lock; รองรับรายการเก่าที่เคยหลุดเป็น qr
    const lockedTx = await Transaction.findOneAndUpdate(
      {
        ...buildPendingTopupMatchFilter({ $in: ["tw", "qr"] }, addedCents),
      },
      {
        $set: { status: "processing" },
      },
      { sort: { createdAt: -1 }, new: true }
    );

    if (lockedTx) {
      const user = await User.findById(lockedTx.userId);
      if (!user) {
        await Transaction.updateOne(
          { _id: lockedTx._id },
          { $set: { status: "failed", note: "matched tw but user not found" } }
        );
        return res.json({ success: true, userNotFound: true });
      }

      const newBalance = await user.addBalance(Number(lockedTx.amount || 0));

      await Transaction.updateOne(
        { _id: lockedTx._id },
        {
          $set: {
            status: "completed",
            matchedBy: lockedTx.method === "tw" ? `tw_${parsed.mode}_amountCents` : `legacy_qr_${parsed.mode}_amountCents`,
            paidAt: new Date(),
            occurredAt: new Date(),
            rawMessage: parsed.rawMessage,
            ipAddress: req.ip,
            note: "matched truewallet",
          },
        }
      );

      return res.json({ success: true, matched: true, amount: lockedTx.amount, paidAmount: rawAmount, balance: newBalance });
    }

    // 🔥 ไม่มี pending → สร้าง unmatched ไว้ตรวจสอบหลังบ้าน
    await Transaction.create({
      method: "tw",
      amount: Math.floor(rawAmount),
      amountCents: addedCents,
      status: "pending",
      occurredAt: new Date(),
      rawMessage: parsed.rawMessage,
      ipAddress: req.ip,
      note: "unmatched truewallet",
    });

    return res.json({ success: true, unmatched: true });
  } catch (e) {
    glog.error("TW ERROR", e);
    return res.status(500).json({ success: false });
  }
}

function makeExpectedTopupAmount(base) {
  const baseCents = Math.round(Number(base || 0) * 100);

  // ✅ สุ่มเศษ 1 - 20 สตางค์ = .01 - .20
  const extraCents = Math.floor(Math.random() * 20) + 1;

  const amountCents = baseCents + extraCents;
  const expectedAmount = amountCents / 100;

  return {
    expectedAmount,
    amountCents,
    extraCents,
  };
}

// =========================
// GET /topup
// =========================
topupRouter.get("/", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId).lean();
    if (!user) return res.redirect("/login");

    const webWallets = await Topup.find({
      isActive: true,
      accountCode: { $in: ["tw", "kbank", "scb", "qr"] },
    }).lean();

    const transactions = await Transaction.find({ userId })
      .sort({ _id: -1 })
      .limit(20)
      .lean();

    res.render("topup/index", {
      title: "เติมเงิน",
      user,
      webWallets,
      transactions,
    });
  } catch (e) {
    glog.error("TOPUP PAGE ERROR", e);
    res.status(500).send("เกิดข้อผิดพลาด");
  }
});

// =========================
// TRUEWALLET GEN LINK
// =========================
topupRouter.post("/truewallet/gen/link", async (req, res) => {
  try {
    const payAmount = Math.round(Number(req.body.amount || 0) * 100) / 100;

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "ยอดเงินไม่ถูกต้อง",
      });
    }

    if (payAmount > 1000000) {
      return res.status(400).json({ ok: false, error: 'จำนวนเงินเกินกำหนด' });
    }

    const webWallet = await Topup.findOne({
      accountCode: "tw",
      isActive: true,
      isSMS: false,
    }).lean();

    if (!webWallet) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบช่องทาง TrueMoney Wallet ที่เปิดใช้งาน",
      });
    }

    if (!webWallet.accountNumber) {
      return res.status(400).json({
        success: false,
        message: "ยังไม่ได้ตั้งค่าเบอร์ TrueMoney Wallet",
      });
    }

    if (!config.TW_GEN_LINK_SECRET) {
      return res.status(500).json({
        success: false,
        message: "ยังไม่ได้ตั้งค่า TW_GEN_LINK_SECRET",
      });
    }

    const r = await axios.post(
      "https://apis.truemoneyservices.com/utils/v1/transfer-link-generator",
      {
        mobile_number: String(webWallet.accountNumber).trim(),
        amount: payAmount.toFixed(2),
      },
      {
        headers: {
          Authorization: `Bearer ${config.TW_GEN_LINK_SECRET}`,
        },
        timeout: 8000,
        validateStatus: (s) => s < 500,
      }
    );

    const url = r?.data?.data?.url;

    if (!url) {
      glog.warn("TW LINK EMPTY RESPONSE", r?.data);

      return res.status(502).json({
        success: false,
        message: "ไม่สามารถสร้างลิงก์ TrueMoney Wallet ได้",
      });
    }

    return res.json({
      success: true,
      ok: true,
      url,

      // ✅ ส่งค่าจาก DB กลับไปให้หน้า EJS ใช้แสดงใน Modal
      accountName: webWallet.accountName || "TrueMoney Wallet",
      accountNumber: webWallet.accountNumber || "-",
      accountCode: webWallet.accountCode || "tw",
    });
  } catch (e) {
    glog.error("TW LINK ERROR", e);

    return res.status(500).json({
      success: false,
      message: e?.message || "สร้างลิงก์ TrueMoney Wallet ไม่สำเร็จ",
    });
  }
});

// =========================
// TRUEWALLET WEBHOOK (FINAL)
// =========================
// หมายเหตุ: /truewallet/gen/link แค่สร้างลิงก์/QR ไม่ได้ทำให้ webhook วิ่งกลับมาเอง
// ต้องตั้ง webhook/SMS forwarder ให้ยิงมาที่ endpoint เหล่านี้
topupPublicRouter.post("/truewallet", webhookLimiter, handleTrueWalletWebhook);
topupPublicRouter.post("/truewallet/webhook", webhookLimiter, handleTrueWalletWebhook);
topupPublicRouter.post("/tw", webhookLimiter, handleTrueWalletWebhook);

topupRouter.post("/truewallet", webhookLimiter, handleTrueWalletWebhook);
topupRouter.post("/truewallet/webhook", webhookLimiter, handleTrueWalletWebhook);
topupRouter.post("/tw", webhookLimiter, handleTrueWalletWebhook);

// =========================
// CREATE TOPUP
// =========================
topupRouter.post("/create", async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) {
      return res.status(401).json({
        ok: false,
        message: "กรุณาเข้าสู่ระบบก่อนเติมเงิน",
      });
    }

    const base = Math.floor(Number(req.body.amount || 0));

    if (!Number.isFinite(base) || base < 1) {
      return res.status(400).json({
        ok: false,
        message: "ยอดเติมขั้นต่ำ 1 บาท",
      });
    }

    // ✅ รับ method จากหน้าเว็บจริง ๆ
    // สำคัญ: หน้า EJS เดิมส่ง walletCode ไม่ใช่ accountCode จึงเคยหลุดเป็น qr
    const method = await resolveRequestedTopupMethod(req.body);
    const expireSeconds = getTopupExpireSeconds(method);
    const expireMinutes = getTopupExpireMinutes(method);

    const now = Date.now();

    // ✅ ถ้ามีรายการ pending เดิมของ method นี้ ให้ใช้รายการเดิม แม้ countdown จะหมดแล้ว
    // กันการสร้าง pending ซ้ำ และไม่ทำให้รายการเก่าของผู้ใช้หาย/ถูกยกเลิก
    const existing = await Transaction.findOne({
      userId: uid,
      method,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existing) {
      const expiredPending = existing.expiresAt ? new Date(existing.expiresAt).getTime() <= Date.now() : false;
      return res.json({
        ok: true,
        txId: String(existing._id),
        method: existing.method,
        amount: Number(existing.amount || 0),
        displayAmount: Number(existing.expectedAmount || existing.amount || 0),
        amountCents: Number(existing.amountCents || 0),
        expiresAt: existing.expiresAt || null,
        expiresIn: expiredPending ? 0 : secondsUntil(existing.expiresAt, expireSeconds),
        expireMinutes,
        reused: true,
        expiredPending,
        mustCancelOld: expiredPending,
        message: expiredPending ? "กรุณายกเลิกรายการเก่าก่อนทำรายการใหม่" : undefined,
      });
    }

    let tx = null;
    let lastErr = null;

    // ✅ พยายามสุ่มเศษ .01 - .20
    // ถ้ายอดซ้ำเพราะมี unique index / pending ชนกัน จะสุ่มใหม่
    for (let i = 0; i < 40; i++) {
      try {
        const { expectedAmount, amountCents, extraCents } = makeExpectedTopupAmount(base);

        tx = await Transaction.create({
          userId: uid,
          method,
          amount: base,

          // ✅ ยอดที่ต้องโอนจริง เช่น 10.01 - 10.20
          expectedAmount,
          amountCents,

          // optional เก็บไว้ดู debug
          topupExtraCents: extraCents,

          status: "pending",
          expiresAt: new Date(now + expireSeconds * 1000),
          note: `${method}_topup_pending`,
          ipAddress: req.ip,
        });

        break;
      } catch (err) {
        lastErr = err;

        // duplicate key จากยอดซ้ำ ให้สุ่มเศษใหม่
        if (err?.code === 11000) {
          continue;
        }

        throw err;
      }
    }

    if (!tx) {
      glog.error("CREATE TOPUP DUPLICATE EXHAUSTED", lastErr);
      return res.status(409).json({
        ok: false,
        message: "ยอดนี้มีคนใช้งานอยู่ กรุณากดสร้างรายการใหม่อีกครั้ง",
      });
    }

    return res.json({
      ok: true,
      txId: String(tx._id),
      method: tx.method,
      amount: Number(tx.amount),
      displayAmount: Number(tx.expectedAmount),
      amountCents: Number(tx.amountCents),
      expiresAt: tx.expiresAt || null,
      expiresIn: secondsUntil(tx.expiresAt, expireSeconds),
      expireMinutes,
      reused: false,
    });
  } catch (e) {
    glog.error("CREATE ERROR", e);
    return res.status(e?.statusCode || 500).json({
      ok: false,
      message: e.message || "สร้างคำสั่งเติมเงินไม่สำเร็จ",
    });
  }
});


// =========================
// CANCEL EXPIRED PENDING TOPUP
// =========================
topupRouter.post("/cancel/:id", async (req, res) => {
  try {
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ ok: false, message: "กรุณาเข้าสู่ระบบ" });

    const tx = await Transaction.findOne({
      _id: req.params.id,
      userId: uid,
      status: "pending",
    });

    if (!tx) return res.status(404).json({ ok: false, message: "ไม่พบรายการที่รอยกเลิก" });

    const expired = tx.expiresAt ? new Date(tx.expiresAt).getTime() <= Date.now() : false;
    if (!expired) {
      return res.status(400).json({ ok: false, message: "รายการนี้ยังไม่หมดเวลา กรุณารอให้หมดเวลาก่อน" });
    }

    tx.set({
      status: "cancelled",
      canceledAt: new Date(),
      note: `${tx.method || "topup"}_topup_cancelled_by_user_after_expired`,
    });
    await tx.save();

    return res.json({ ok: true, cancelled: true });
  } catch (e) {
    glog.error("CANCEL TOPUP ERROR", e);
    return res.status(500).json({ ok: false, message: "ยกเลิกรายการไม่สำเร็จ" });
  }
});

// =========================
// GET TX STATUS
// =========================
topupRouter.get("/tx/:id", async (req, res) => {
  try {
    setNoStore(res);
    const uid = getAuthUserId(req);
    if (!uid) return res.status(401).json({ ok: false });

    const tx = await Transaction.findOne({
      _id: req.params.id,
      userId: uid,
    }).lean();

    if (!tx) return res.status(404).json({ ok: false });

    res.json({
      ok: true,
      status: tx.status,
      method: tx.method,
      amount: tx.amount,
      displayAmount: tx.expectedAmount || tx.amount,
      paidAt: tx.paidAt || null,
      expiresAt: tx.expiresAt || null,
      expiresIn: tx.expiresAt ? Math.max(0, Math.ceil((new Date(tx.expiresAt).getTime() - Date.now()) / 1000)) : null,
      expired: tx.expiresAt ? new Date(tx.expiresAt).getTime() <= Date.now() : false,
    });
  } catch {
    res.status(500).json({ ok: false });
  }
});


// =========================
// POST MacroDroid test notification
// =========================
// ใช้สำหรับทดสอบอ่านข้อความแจ้งเตือนจาก MacroDroid เท่านั้น
// URL ตัวอย่าง:
//   POST /topup/macrodroid-test
//   POST /api/topup/macrodroid-test
// TEST ONLY: ไม่ต้องส่ง token/secret ในช่วงทดสอบ
const macrodroidBodyParser = express.text({
  type: ["text/*", "application/octet-stream"],
  limit: "64kb",
});

topupPublicRouter.post("/macrodroid-test", macrodroidBodyParser, webhookLimiter, handleMacrodroidTestWebhook);
topupRouter.post("/macrodroid-test", macrodroidBodyParser, webhookLimiter, handleMacrodroidTestWebhook);

// =========================
// POST KBANK
// =========================
// เติมเครดิต KBANK แบบจับคู่ด้วยยอดเงิน + เศษ (อัปเดต)
async function handleKbankWebhook(req, res) {
  try {
    const payload = payloadToObject(req.body || {});
    const message = String(payload.message || payload.text || payload.body || payload.sms || payload.__rawText || "").trim();
    const secret = readWebhookSecret(req, payload);
    const timestamp = Number(payload.timestamp || payload.ts || 0);

    if (!message) return res.status(400).json({ success: false, message: "message required" });

    const topup = await Topup.findOne({
      accountCode: "kbank",
      isActive: true,
    }).lean();

    if (!topup || String(secret).trim() !== String(topup.secret).trim()) {
      return res.status(401).json({ success: false, message: "invalid secret" });
    }

    if (timestamp && Math.abs(Date.now() - timestamp * 1000) > 10 * 60 * 1000) {
      return res.status(400).json({ success: false, message: "invalid timestamp" });
    }

    const regex = /(\d{2})\/(\d{2})(?:\/(\d{2}))?\s+(\d{2}):(\d{2})\s+บช\s+X-(\d+)\s+(?:รับโอนจาก\s+X-(\d+)\s+)?(?:เงินเข้า|รับโอนจาก\s+X-\d+)\s+([\d,]+\.\d{2})/i;
    const match = String(message).match(regex);
    if (!match) return res.status(400).json({ success: false });

    let [
      _,
      day,
      month,
      year2,
      hour,
      minute,
      receiverDigits,
      senderDigits,
      amountStr,
    ] = match;

    if (topup.accountNumber && receiverDigits) {
      if (!topup.accountNumber.endsWith(receiverDigits)) {
        return res.status(403).json({ success: false });
      }
    }

    const amt = Number(amountStr.replace(/,/g, "")) || 0;
    const amtCents = Math.round(amt * 100);

    const year = year2 ? 2000 + Number(year2) : new Date().getFullYear();
    const seconds = timestamp ? new Date(timestamp * 1000).getSeconds() : new Date().getSeconds();

    const parsedDate = makeBangkokDateFromParts(
      year,
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      seconds
    );

    // 🔥 DEDUPE ±2 นาที
    const dup = await Transaction.findOne({
      method: "kbank",
      amountCents: amtCents,
      status: "completed",
      occurredAt: {
        $gte: new Date(parsedDate.getTime() - 2 * 60 * 1000),
        $lte: new Date(parsedDate.getTime() + 2 * 60 * 1000),
      },
    }).lean();

    if (dup) {
      return res.json({ success: true, deduped: true });
    }

    await cleanupExpiredProcessingTransactions();

    const pendingTx = await Transaction.findOneAndUpdate(
      buildPendingTopupMatchFilter("kbank", amtCents),
      { $set: { status: "processing" } },
      { sort: { createdAt: -1 }, new: true }
    );

    if (!pendingTx) {
      await Transaction.create({
        method: "kbank",
        amount: amt,
        amountCents: amtCents,
        status: "pending",
        senderLast6: senderDigits?.slice(-6),
        receiverLast6: receiverDigits?.slice(-6),
        occurredAt: parsedDate,
        note: "unmatched by amount",
      });

      return res.json({ success: true, unmatched: true });
    }

    const user = await User.findById(pendingTx.userId);
    if (!user) return res.json({ success: true });

    // ✅ เติมเครดิตตามยอดฐานที่ผู้ใช้กรอก ไม่รวมเศษสตางค์ที่ใช้สำหรับ match
    const creditAmount = Number(pendingTx.amount || 0);
    const newBalance = await user.addBalance(creditAmount);

    pendingTx.set({
      status: "completed",
      matchedBy: "amountCents",
      senderLast6: senderDigits?.slice(-6),
      receiverLast6: receiverDigits?.slice(-6),
      occurredAt: parsedDate,
      paidAt: new Date(),
      note: "matched kbank",
    });

    await pendingTx.save();

    return res.json({
      success: true,
      amount: creditAmount,
      paidAmount: amt,
      balance: newBalance,
    });

  } catch (e) {
    glog.error("KBANK ERROR", e);
    return res.status(500).json({ success: false });
  }
}

topupPublicRouter.post("/kbank", express.text({ type: ["text/*", "application/octet-stream"], limit: "64kb" }), webhookLimiter, handleKbankWebhook);
topupRouter.post("/kbank", express.text({ type: ["text/*", "application/octet-stream"], limit: "64kb" }), webhookLimiter, handleKbankWebhook);

// =========================
// POST SCB
// =========================
// เติมเครดิต SCB แบบจับคู่ด้วยยอดเงิน + เศษ (อัปเดตให้ logic = KBANK)
async function handleScbWebhook(req, res) {
  try {
    const payload = payloadToObject(req.body || {});
    const message = String(payload.message || payload.text || payload.body || payload.sms || payload.__rawText || "").trim();
    const secret = readWebhookSecret(req, payload);
    const timestamp = Number(payload.timestamp || payload.ts || 0);

    if (!message) return res.status(400).json({ success: false, message: "message required" });

    const topup = await Topup.findOne({
      accountCode: "scb",
      isActive: true,
    }).lean();

    if (!topup || String(secret).trim() !== String(topup.secret).trim()) {
      return res.status(401).json({ success: false, message: "invalid secret" });
    }

    if (timestamp && Math.abs(Date.now() - timestamp * 1000) > 10 * 60 * 1000) {
      return res.status(400).json({ success: false, message: "invalid timestamp" });
    }

    const regex = /(\d{2})\/(\d{2})@(\d{2}):(\d{2})\s+([\d,]+\.\d{2})\s+จาก([A-Z]+)\/x(\d+).*?เข้าx(\d+)/i;
    const match = String(message).match(regex);
    if (!match) return res.status(400).json({ success: false });

    let [
      _,
      day,
      month,
      hour,
      minute,
      amountStr,
      bank,
      senderDigits,
      receiverDigits,
    ] = match;

    // 🔥 normalize bank
    const senderBank = String(bank || "").toLowerCase().trim();

    // 🔥 กัน account ไม่ตรง
    if (topup.accountNumber && receiverDigits) {
      if (!topup.accountNumber.endsWith(receiverDigits)) {
        return res.status(403).json({ success: false });
      }
    }

    const amt = Number(amountStr.replace(/,/g, "")) || 0;
    if (!amt) return res.status(400).json({ success: false });

    const amtCents = Math.round(amt * 100);

    const seconds = timestamp ? new Date(timestamp * 1000).getSeconds() : new Date().getSeconds();

    const parsedDate = makeBangkokDateFromParts(
      new Date().getFullYear(),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      seconds
    );

    // 🔥 DEDUPE
    const dup = await Transaction.findOne({
      method: "scb",
      amountCents: amtCents,
      status: "completed",
      occurredAt: {
        $gte: new Date(parsedDate.getTime() - 2 * 60 * 1000),
        $lte: new Date(parsedDate.getTime() + 2 * 60 * 1000),
      },
    }).lean();

    if (dup) {
      return res.json({ success: true, deduped: true });
    }

    await cleanupExpiredProcessingTransactions();

    const pendingTx = await Transaction.findOneAndUpdate(
      buildPendingTopupMatchFilter("scb", amtCents),
      { $set: { status: "processing" } },
      { sort: { createdAt: -1 }, new: true }
    );

    if (!pendingTx) {
      await Transaction.create({
        method: "scb",
        amount: amt,
        amountCents: amtCents,
        status: "pending",
        senderLast6: senderDigits?.slice(-6),
        receiverLast6: receiverDigits?.slice(-6),
        senderBank,
        occurredAt: parsedDate,
        rawMessage: message,
        ipAddress: req.ip,
        note: "unmatched by amount",
      });

      return res.json({ success: true, unmatched: true });
    }

    const user = await User.findById(pendingTx.userId);
    if (!user) return res.json({ success: true });

    // ✅ เติมเครดิตตามยอดฐานที่ผู้ใช้กรอก ไม่รวมเศษสตางค์ที่ใช้สำหรับ match
    const creditAmount = Number(pendingTx.amount || 0);
    const newBalance = await user.addBalance(creditAmount);

    pendingTx.set({
      status: "completed",
      matchedBy: "amountCents",
      senderLast6: senderDigits?.slice(-6),
      receiverLast6: receiverDigits?.slice(-6),
      senderBank,
      occurredAt: parsedDate,
      paidAt: new Date(),
      rawMessage: message,
      ipAddress: req.ip,
      note: "matched scb",
    });

    await pendingTx.save();

    return res.json({
      success: true,
      amount: creditAmount,
      paidAmount: amt,
      balance: newBalance,
    });

  } catch (e) {
    glog.error("SCB ERROR", e);
    return res.status(500).json({ success: false });
  }
}

topupPublicRouter.post("/scb", express.text({ type: ["text/*", "application/octet-stream"], limit: "64kb" }), webhookLimiter, handleScbWebhook);
topupRouter.post("/scb", express.text({ type: ["text/*", "application/octet-stream"], limit: "64kb" }), webhookLimiter, handleScbWebhook);