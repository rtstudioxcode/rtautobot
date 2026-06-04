// src/services/macrodroidInbox.js
// Helper สำหรับเก็บ raw notification/webhook จาก MacroDroid ผ่าน endpoint เติมเงินเดิม
// ไม่เปิด route ใหม่: ใช้ใน routes/topup.js เท่านั้น เพื่อให้ KBank/TrueWallet flow เดิมเป็น source of truth
import crypto from "crypto";

import { MacroDroidInbox } from "../models/MacroDroidInbox";

const MAX_TEXT_LEN = 5000;

function cleanText(value = "") {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, MAX_TEXT_LEN);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const s = cleanText(value);
    if (s) return s;
  }
  return "";
}

function getClientIp(req) {
  return String(
    req?.headers?.["cf-connecting-ip"] ||
    req?.headers?.["x-forwarded-for"] ||
    req?.ip ||
    ""
  ).split(",")[0].trim();
}

function parseAmount(text = "") {
  const s = String(text || "").replace(/,/g, "");
  const matches = [...s.matchAll(/(?:เงินเข้า|รับโอน|ฝาก|จำนวนเงิน|amount|ยอด)?\s*([0-9]{1,9}(?:\.[0-9]{1,2})?)\s*(?:บาท|THB|฿)?/gi)];

  for (const m of matches) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parseAccountLast4(text = "") {
  const s = String(text || "");
  const m = s.match(/(?:บัญชี|account|บช|x{1,}|\*{2,})[^0-9]{0,12}([0-9]{4})(?![0-9])/i);
  return m ? m[1] : "";
}

function parseTransactionRef(text = "") {
  const s = String(text || "");
  const m = s.match(/\b([0-9]{6,}[A-Z]{2,}[0-9A-Z]{4,}|[0-9A-Za-z]{16,})\b/);
  return m ? m[1] : "";
}

function normalizeBank(value = "", text = "") {
  const blob = `${value} ${text}`.toLowerCase();
  if (/true\s*money|truewallet|truemoney|wallet|ทรู/.test(blob)) return "tw";
  if (/k\s*plus|kasikorn|kbank|กสิกร/.test(blob)) return "kbank";
  if (/scb|easy|ไทยพาณิชย์/.test(blob)) return "scb";
  if (/krungthai|ktb|next|กรุงไทย/.test(blob)) return "ktb";
  if (/gsb|ออมสิน/.test(blob)) return "gsb";
  if (/bangkok|bbl|กรุงเทพ/.test(blob)) return "bbl";
  if (/krungsri|bay|กรุงศรี/.test(blob)) return "bay";
  if (/ttb|ทหารไทย|ธนชาต/.test(blob)) return "ttb";
  if (/dime|kkp|เกียรตินาคิน/.test(blob)) return "kkp";
  return cleanText(value).toLowerCase();
}

function parseNotificationAt(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function buildEventHash(payload) {
  const stable = JSON.stringify({
    source: payload.source || "",
    channel: payload.channel || "",
    deviceId: payload.deviceId || "",
    bank: payload.bank || "",
    title: payload.title || "",
    rawText: payload.rawText || "",
    amount: payload.amount ?? null,
    notificationAt: payload.notificationAt ? payload.notificationAt.toISOString() : "",
    transactionRef: payload.transactionRef || "",
  });
  return crypto.createHash("sha256").update(stable).digest("hex");
}

function payloadToPlainRaw(raw: any = {}) {
  if (typeof raw === "string") return raw;
  try { return JSON.stringify(raw); } catch { return String(raw || ""); }
}

export function buildMacroDroidInboxPayload(req: any, options: any = {}) {
  const raw = options.raw || req?.body || {};
  const body = raw && typeof raw === "object" && !Buffer.isBuffer(raw) ? raw : {};
  const title = firstNonEmpty(options.title, body.title, body.notificationTitle, body.appTitle);
  const text = firstNonEmpty(options.text, body.text, body.notificationText, body.message, body.content, body.sms, body.body);
  const bigText = firstNonEmpty(options.bigText, body.bigText, body.notificationBigText, body.extraText, body.fullText);
  const rawText = firstNonEmpty(
    options.rawText,
    body.rawText,
    body.__rawText,
    [title, text, bigText].filter(Boolean).join("\n"),
    payloadToPlainRaw(raw)
  );

  const appName = firstNonEmpty(options.appName, body.appName, body.application, body.packageName);
  const appPackage = firstNonEmpty(options.appPackage, body.appPackage, body.package, body.pkg, body.packageName);
  const deviceId = firstNonEmpty(options.deviceId, body.deviceId, body.device, body.phoneId, body.androidId);
  const notificationAt = parseNotificationAt(options.notificationAt || body.notificationAt || body.eventAt || body.time || body.timestamp);
  const amount = options.amount !== undefined && options.amount !== null && options.amount !== ""
    ? Number(String(options.amount).replace(/,/g, ""))
    : body.amount !== undefined && body.amount !== null && body.amount !== ""
      ? Number(String(body.amount).replace(/,/g, ""))
      : parseAmount(rawText);

  const payload: any = {
    source: firstNonEmpty(options.source, body.source) || "macrodroid",
    channel: firstNonEmpty(options.channel, body.channel) || "topup_webhook",
    deviceId,
    bank: normalizeBank(options.bank || body.bank || body.accountCode || "", `${appName} ${title} ${rawText}`),
    appPackage,
    appName,
    title,
    text,
    bigText,
    rawText,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    currency: firstNonEmpty(options.currency, body.currency) || "THB",
    accountLast4: firstNonEmpty(options.accountLast4, body.accountLast4, body.accountSuffix) || parseAccountLast4(rawText),
    transactionRef: firstNonEmpty(options.transactionRef, body.transactionRef, body.ref, body.reference) || parseTransactionRef(rawText),
    notificationAt,
    ip: getClientIp(req),
    userAgent: cleanText(req?.headers?.["user-agent"] || ""),
    raw,
  };

  payload.eventHash = buildEventHash(payload);
  return payload;
}

export async function storeMacroDroidInbox(req: any, options: any = {}) {
  const payload = buildMacroDroidInboxPayload(req, options);
  if (!payload.rawText && !payload.title && !payload.text) {
    return { ok: false, skipped: true, reason: "missing_notification_text" };
  }

  try {
    const doc = await MacroDroidInbox.create(payload);
    return { ok: true, inserted: true, duplicate: false, eventHash: payload.eventHash, doc };
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
    await MacroDroidInbox.updateOne(
      { eventHash: payload.eventHash },
      {
        $inc: { duplicateCount: 1 },
        $set: { lastDuplicateAt: new Date() },
      }
    );
    return { ok: true, inserted: false, duplicate: true, eventHash: payload.eventHash };
  }
}
