// src/services/spend.js
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Service } from '../models/Service.js';
import { Otp24Order } from '../models/Otp24Order.js';
import { Otp24AppsOrder } from '../models/Otp24AppsOrder.js';
import { LEVELS as LV_LOYALTY, getRateForLevelIndex as _getRate } from './loyalty.js';

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => config?.system?.globalLogEnabled === true;
const glog = {
  log: (...args) => { if (isGlobalLogEnabled()) console.log(...args); },
  info: (...args) => { if (isGlobalLogEnabled()) console.info(...args); },
  warn: (...args) => { if (isGlobalLogEnabled()) console.warn(...args); },
  error: (...args) => { if (isGlobalLogEnabled()) console.error(...args); },
};

const nz = (v) => (Number.isFinite(+v) ? +v : 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const positive = (n) => Math.max(0, round2(n));

// SMM: นับเฉพาะงานที่สำเร็จจริง และงาน partial เท่านั้น
export const PAID_STATUSES = ['completed', 'partial'];
const COUNTABLE = new Set(PAID_STATUSES.map(s => String(s).toLowerCase()));

// OTP24 เบอร์: นับเฉพาะ success เท่านั้น
export const OTP24_PAID_STATUSES = ['success'];
const OTP24_COUNTABLE = new Set(OTP24_PAID_STATUSES.map(s => String(s).toLowerCase()));

// Apps/getpack: ต้นทางมักขึ้น success ตั้งแต่รับออเดอร์ จึงนับ success เฉพาะที่ไม่ refund/cancel
export const APPS_PAID_STATUSES = ['success'];
const APPS_COUNTABLE = new Set(APPS_PAID_STATUSES.map(s => String(s).toLowerCase()));

// TelegramBot ไม่รวมใน spend/level/points/order count ตาม requirement ล่าสุด
export const TELEGRAM_PAID_STATUSES = [];

export const LEVELS = Object.freeze([
  { name:'เลเวล 1',   need:0 },
  { name:'เลเวล 2',   need:5_000 },
  { name:'เลเวล 3',   need:10_000 },
  { name:'เลเวล 4',   need:30_000 },
  { name:'เลเวล 5',   need:50_000 },
  { name:'Retail',    need:80_000 },
  { name:'Wholesale', need:175_000 },
  { name:'Reseller',  need:700_000 },
  { name:'VIP',       need:1_000_000 },
  { name:'Legendary', need:5_000_000 },
]);

export function calcPoints(totalSpentEff = 0) {
  const spent = Math.max(0, Number(totalSpentEff) || 0);
  const earned = Math.floor(spent / 50) * 0.5;
  return positive(earned);
}

function getRateForLevelIndex(idx = 0) {
  if (typeof _getRate === 'function') return _getRate(idx);
  const lv = LV_LOYALTY?.[idx];
  if (!lv?.rate) return 0;
  const n = Number(String(lv.rate).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const lastRunAt = new Map();
const COOLDOWN_MS = 5_000;

export function computeLevel(total = 0) {
  const t = Math.max(0, Number(total) || 0);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (t >= LEVELS[i].need) idx = i; else break;
  }
  return String(Math.max(1, idx + 1));
}

export function decideLevel(total = 0) {
  const t = Math.max(0, Number(total) || 0);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (t >= LEVELS[i].need) idx = i; else break;
  }
  const lv = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  return { index: idx, name: lv.name, need: lv.need, nextName: next?.name || null, toNext: next ? Math.max(0, next.need - t) : 0 };
}

function buildUserMatch(userId) {
  const idStr = String(userId || '');
  const oid = mongoose.Types.ObjectId.isValid(idStr) ? new mongoose.Types.ObjectId(idStr) : null;
  return { $or: [ ...(oid ? [{user:oid},{userId:oid}] : []), {user:idStr},{userId:idStr} ] };
}

function pickUserId(doc) {
  return doc?.userId || doc?.user;
}

function orderBaseCost(order) {
  const qty = nz(order?.quantity);
  const rate = nz(order?.rateAtOrder) || nz(order?.rate);
  return round2(nz(order?.cost) || nz(order?.estCost) || nz(order?.charged) || (qty ? (rate * qty) / 1000 : 0));
}

function orderRefund(order) {
  let refund = nz(order?.refundAmount);
  if (!refund && Array.isArray(order?.partialRefunds)) {
    refund = order.partialRefunds.reduce((s, r) => s + nz(r?.amount), 0);
  }
  return round2(refund);
}

// ─────────────────────────────────────────────────────────────
// คำนวณสุทธิ SMM
// - completed: ราคาเต็ม - refund
// - partial: นับยอดที่ลูกค้าจ่ายจริงหลังคืนส่วนต่าง (ถ้ามี refundAmount ให้ใช้ราคาเต็ม - refund)
//            ถ้าไม่มี refundAmount ให้คิดตาม delivered/remains เป็น fallback
// - canceled/processing/pending: 0
// ─────────────────────────────────────────────────────────────
export function calcOrderNetTHB(order) {
  if (!order) return 0;
  const st = String(order.status || '').toLowerCase();
  if (!COUNTABLE.has(st)) return 0;

  const baseCost = orderBaseCost(order);
  const refund = orderRefund(order);

  if (st === 'completed') return positive(baseCost - refund);
  if (st === 'partial' && refund > 0) return positive(baseCost - refund);

  const qty = nz(order.quantity);
  let delivered = 0;
  if (qty > 0) {
    const remains = nz(order.remains);
    if (remains > 0) {
      delivered = Math.max(0, Math.min(qty, qty - remains));
    } else {
      const d1 = nz(order.currentCount) - nz(order.startCount);
      if (d1 > 0) delivered = Math.min(qty, d1);
      else {
        const pr = order?.providerResponse?.lastStatus;
        const r2 = nz(pr?.remains);
        if (r2 > 0) delivered = Math.max(0, Math.min(qty, qty - r2));
      }
    }
  }
  const ratio = (qty > 0) ? Math.max(0, Math.min(1, delivered / qty)) : 0;
  return positive(baseCost * ratio);
}

export function calcOtp24NetTHB(doc) {
  if (!doc) return 0;
  const st = String(doc.status || '').toLowerCase();
  if (!OTP24_COUNTABLE.has(st)) return 0;
  const gross = nz(doc.salePrice);
  const refund = nz(doc.refundAmount);
  return positive(gross - refund);
}

export function calcAppsNetTHB(doc) {
  if (!doc) return 0;
  const st = String(doc.status || '').toLowerCase();
  if (!APPS_COUNTABLE.has(st)) return 0;
  if (doc.refundApplied === true || /^(refunded|canceled|failed)$/i.test(st)) return 0;
  const gross = nz(doc.salePrice);
  const refund = nz(doc.refundAmount);
  return positive(gross - refund);
}

export function calcTelegramNetTHB() {
  return 0;
}

async function incUserSpent(userId, delta, { session } = {}) {
  const d = round2(delta);
  if (!d) return;
  await User.updateOne({ _id: userId }, { $inc: { totalSpentRaw: d } }, { session });
}

export async function reconcileUserByOrderEvent(orderId, { force = true } = {}) {
  if (!orderId) return { ok:false, error:'orderId is required' };
  const o = await Order.findById(orderId).select('_id user userId').lean();
  if (!o) return { ok:false, error:'order not found' };
  await reconcileOrderSpend(orderId);
  await recalcUserTotals(pickUserId(o), { force, reason:'order_event' });
  return { ok:true, userId: String(pickUserId(o)) };
}

function calcSmmRefundDue(order, currentNet = calcOrderNetTHB(order)) {
  if (!order || order.refundCommitted === true) return { amount: 0, type: null };

  const st = String(order.status || '').toLowerCase();
  const base = orderBaseCost(order);
  if (base <= 0) return { amount: 0, type: null };

  let amount = 0;
  let type = null;

  if (/^(canceled|cancelled|failed|refunded)$/.test(st)) {
    // Terminal no-delivery statuses: refund the real sale amount unless a larger/explicit refund was recorded.
    amount = nz(order.refundAmount) || positive(base - currentNet) || base;
    type = amount >= base - 0.005 ? 'full' : 'partial';
  } else if (st === 'partial') {
    // Partial: refund only the not-delivered part. Prefer provider-calculated refundAmount.
    amount = nz(order.refundAmount) || positive(base - currentNet);
    type = amount >= base - 0.005 ? 'full' : (amount > 0 ? 'partial' : null);
  }

  amount = Math.min(base, positive(amount));
  return { amount, type };
}

// ─────────────────────────────────────────────────────────────
// Reconcile ต่อใบ:
// - spentAccounted/totalSpentRaw = ยอดที่ควรถูกนับเป็น spend จริง
// - balance refund = คืนจาก refundAmount/cost โดยตรงเมื่อ canceled/failed/partial
//   ไม่ผูกกับ delta อย่างเดียว เพราะออเดอร์บางชุด spentAccounted=0 ตั้งแต่แรก
//   แต่ถูกตัดเครดิตตอนสร้างออเดอร์ไปแล้ว
// ─────────────────────────────────────────────────────────────
export async function reconcileOrderSpend(orderId, { session } = {}) {
  const q = Order.findById(orderId).populate({ path: 'service', model: Service });
  if (session) q.session(session);
  const o = await q;
  if (!o) return { ok:false, reason:'not_found' };

  const currentNet = calcOrderNetTHB(o);
  const accounted = nz(o.spentAccounted);
  const delta = round2(currentNet - accounted);
  const uid = pickUserId(o);
  if (!uid) return { ok:false, reason:'missing_user' };

  const refundDue = calcSmmRefundDue(o, currentNet);
  const shouldRefundWallet = refundDue.amount > 0 && o.refundCommitted !== true;

  // สำคัญ: จองสิทธิ์ refund ด้วย atomic update ก่อนเพิ่ม balance เพื่อกัน worker/hook ยิงซ้ำ
  if (shouldRefundWallet) {
    const base = orderBaseCost(o);
    const orderSet = {
      spentAccounted: currentNet,
      spentAccountedAt: new Date(),
      refundCommitted: true,
      refundAmount: Math.max(nz(o.refundAmount), refundDue.amount),
      refundType: refundDue.type || (refundDue.amount >= base - 0.005 ? 'full' : 'partial'),
      updatedAt: new Date(),
    };

    const claim = await Order.updateOne(
      { _id: o._id, refundCommitted: { $ne: true } },
      { $set: orderSet },
      { session }
    );

    if (!(claim?.modifiedCount || claim?.nModified)) {
      return { ok:true, changed:false, delta:0, refunded:0, skipped:true, reason:'refund_already_committed' };
    }

    const inc = { balance: refundDue.amount };
    if (delta !== 0) inc.totalSpentRaw = delta;

    await User.updateOne(
      { _id: uid },
      { $inc: inc, $set: { lastSpentAt: new Date() } },
      { session }
    );

    return { ok:true, changed:true, delta, refunded:refundDue.amount, newAccounted:currentNet };
  }

  if (delta === 0) {
    if (!o.spentAccountedAt) {
      await Order.updateOne({ _id: o._id }, { $set: { spentAccounted: currentNet, spentAccountedAt: new Date() } }, { session });
    }
    return { ok:true, changed:false, delta:0, refunded:0, newAccounted:currentNet };
  }

  await User.updateOne({ _id: uid }, { $inc: { totalSpentRaw: delta }, $set: { lastSpentAt: new Date() } }, { session });
  await Order.updateOne({ _id: o._id }, { $set: { spentAccounted: currentNet, spentAccountedAt: new Date() } }, { session });
  return { ok:true, changed:true, delta, refunded:0, newAccounted:currentNet };
}

export async function reconcileOtp24OrderSpend(orderId, { session } = {}) {
  const q = Otp24Order.findById(orderId);
  if (session) q.session(session);
  const o = await q;
  if (!o) return { ok:false, reason:'not_found' };

  const currentNet = calcOtp24NetTHB(o);
  const accounted = nz(o.otpSpentAccounted);
  const delta = round2(currentNet - accounted);
  if (delta !== 0) {
    // Atomic update: only apply if otpSpentAccounted still matches what we read (prevents double-count)
    const upd = await Otp24Order.findOneAndUpdate(
      { _id: o._id, otpSpentAccounted: accounted },
      { $set: { otpSpentAccounted: currentNet, otpSpentAccountedAt: new Date() } },
      { new: false, session }
    );
    if (!upd) return { ok:true, changed:false, delta:0, newAccounted:accounted, skipped:true };
    await incUserSpent(o.userId || o.user, delta, { session });
  }
  return { ok:true, changed:delta !== 0, delta, newAccounted:currentNet };
}

export async function reconcileAppsOrderSpend(orderId, { session } = {}) {
  const q = Otp24AppsOrder.findById(orderId);
  if (session) q.session(session);
  const o = await q;
  if (!o) return { ok:false, reason:'not_found' };

  const currentNet = calcAppsNetTHB(o);
  const accounted = nz(o.appsSpentAccounted);
  const delta = round2(currentNet - accounted);
  if (delta !== 0) {
    // Atomic update: only apply if appsSpentAccounted still matches what we read (prevents double-count)
    const upd = await Otp24AppsOrder.findOneAndUpdate(
      { _id: o._id, appsSpentAccounted: accounted },
      { $set: { appsSpentAccounted: currentNet, appsSpentAccountedAt: new Date() } },
      { new: false, session }
    );
    if (!upd) return { ok:true, changed:false, delta:0, newAccounted:accounted, skipped:true };
    await incUserSpent(o.user, delta, { session });
  } else if (!o.appsSpentAccountedAt && currentNet > 0) {
    await Otp24AppsOrder.updateOne({ _id: o._id }, { $set: { appsSpentAccountedAt: new Date() } }, { session });
  }
  return { ok:true, changed:delta !== 0, delta, newAccounted:currentNet };
}

export async function reconcileTelegramJobSpend() {
  // TelegramBot ไม่ถูกนับรวม spend แล้ว จึงไม่แตะยอดผู้ใช้
  return { ok:true, changed:false, delta:0, newAccounted:0, ignored:true };
}

export async function reconcileAllOrdersForUser(userId) {
  const match = buildUserMatch(userId);
  const list = await Order.find(match, {
    status:1, quantity:1, rate:1, rateAtOrder:1, cost:1, estCost:1, charged:1,
    refundAmount:1, partialRefunds:1, spentAccounted:1,
    remains:1, startCount:1, currentCount:1, providerResponse:1,
    user:1, userId:1
  }).lean();

  let sumDelta = 0;
  const bulk = [];
  for (const o of list) {
    const currentNet = calcOrderNetTHB(o);
    const accounted = nz(o.spentAccounted);
    const delta = round2(currentNet - accounted);
    if (delta === 0) continue;
    sumDelta = round2(sumDelta + delta);
    bulk.push({ updateOne: { filter:{ _id:o._id }, update:{ $set:{ spentAccounted:currentNet, spentAccountedAt:new Date() } } } });
  }
  if (sumDelta !== 0) await User.updateOne({ _id:userId }, { $inc:{ totalSpentRaw:sumDelta } });
  if (bulk.length) await Order.bulkWrite(bulk, { ordered:false });
  return { ok:true, sumDelta, changed:bulk.length };
}

export async function reconcileAllOtp24ForUser(userId) {
  const match = buildUserMatch(userId);
  const list = await Otp24Order.find({ ...match }, { status:1, salePrice:1, refundAmount:1, otpSpentAccounted:1 }).lean();
  let sumDelta = 0;
  const bulk = [];
  for (const o of list) {
    const currentNet = calcOtp24NetTHB(o);
    const accounted = nz(o.otpSpentAccounted);
    const delta = round2(currentNet - accounted);
    if (delta === 0) continue;
    sumDelta = round2(sumDelta + delta);
    bulk.push({ updateOne: { filter:{ _id:o._id }, update:{ $set:{ otpSpentAccounted:currentNet, otpSpentAccountedAt:new Date() } } } });
  }
  if (sumDelta !== 0) await User.updateOne({ _id:userId }, { $inc:{ totalSpentRaw:sumDelta } });
  if (bulk.length) await Otp24Order.bulkWrite(bulk, { ordered:false });
  return { ok:true, sumDelta, changed:bulk.length };
}

export async function reconcileAllAppsForUser(userId) {
  const match = buildUserMatch(userId);
  const list = await Otp24AppsOrder.find({ ...match }, { status:1, salePrice:1, refundAmount:1, refundApplied:1, appsSpentAccounted:1 }).lean();
  let sumDelta = 0;
  const bulk = [];
  for (const o of list) {
    const currentNet = calcAppsNetTHB(o);
    const accounted = nz(o.appsSpentAccounted);
    const delta = round2(currentNet - accounted);
    if (delta === 0) continue;
    sumDelta = round2(sumDelta + delta);
    bulk.push({ updateOne: { filter:{ _id:o._id }, update:{ $set:{ appsSpentAccounted:currentNet, appsSpentAccountedAt:new Date() } } } });
  }
  if (sumDelta !== 0) await User.updateOne({ _id:userId }, { $inc:{ totalSpentRaw:sumDelta } });
  if (bulk.length) await Otp24AppsOrder.bulkWrite(bulk, { ordered:false });
  return { ok:true, sumDelta, changed:bulk.length };
}

export async function reconcileAllTelegramForUser() {
  // TelegramBot ไม่ถูกนับรวม spend แล้ว
  return { ok:true, sumDelta:0, changed:0, ignored:true };
}

// ─────────────────────────────────────────────────────────────
// Recalc รวม (ไม่รวม Bonustime ตาม requirement)
// totalSpentRaw = ledger สะสมที่มาจากทุกบริการที่ countable แล้วเท่านั้น
// totalSpent = ยอดสำหรับ level/points หลังหัก redeemedSpent แต่ไม่มีทางติดลบ
// ─────────────────────────────────────────────────────────────

async function computeAuthoritativeSourceSpent(userId) {
  const userMatch = buildUserMatch(userId);

  const [orders, otps, apps] = await Promise.all([
    Order.find({ ...userMatch, status:{ $in:PAID_STATUSES } }, {
      status:1, quantity:1, rate:1, rateAtOrder:1, cost:1, estCost:1, charged:1,
      refundAmount:1, partialRefunds:1, remains:1, startCount:1, currentCount:1, providerResponse:1
    }).lean(),
    Otp24Order.find({ ...userMatch, status:{ $in:OTP24_PAID_STATUSES } }, { status:1, salePrice:1, refundAmount:1 }).lean(),
    Otp24AppsOrder.find({ ...userMatch, status:{ $in:APPS_PAID_STATUSES }, refundApplied:{ $ne:true } }, { status:1, salePrice:1, refundAmount:1, refundApplied:1 }).lean(),
  ]);

  const smm = orders.reduce((sum, o) => round2(sum + calcOrderNetTHB(o)), 0);
  const otp = otps.reduce((sum, o) => round2(sum + calcOtp24NetTHB(o)), 0);
  const appsSum = apps.reduce((sum, o) => round2(sum + calcAppsNetTHB(o)), 0);

  // Source of truth ล่าสุด: นับเฉพาะ SMM + OTP24 + APPS เท่านั้น
  // ไม่รวม TelegramBot / Bonustime / ระบบอื่น ๆ
  return { smm, otp, apps: appsSum, telegram:0, total: positive(smm + otp + appsSum) };
}
export async function recalcUserTotals(userId, opts = {}) {
  const { force = false, fullRescan = false } = opts;
  if (!userId) return { ok:false, error:'userId is required' };

  const uid = String(userId);
  const now = Date.now();
  const last = lastRunAt.get(uid) || 0;
  if (!force && now - last < COOLDOWN_MS) return { ok:true, skipped:true, reason:'cooldown' };
  lastRunAt.set(uid, now);

  const userMatch = buildUserMatch(userId);

  let smmDelta = 0, otpDelta = 0, appsDelta = 0, telegramDelta = 0;
  if (fullRescan) {
    const r = await Promise.allSettled([
      reconcileAllOrdersForUser(userId),
      reconcileAllOtp24ForUser(userId),
      reconcileAllAppsForUser(userId),
    ]);
    smmDelta = r[0].status === 'fulfilled' ? nz(r[0].value?.sumDelta) : 0;
    otpDelta = r[1].status === 'fulfilled' ? nz(r[1].value?.sumDelta) : 0;
    appsDelta = r[2].status === 'fulfilled' ? nz(r[2].value?.sumDelta) : 0;
    telegramDelta = 0;
  }

  const [ordAll, ordPaid, otpAll, otpPaid, appsAll, appsPaid] = await Promise.all([
    Order.countDocuments({ ...userMatch, status:{ $in:PAID_STATUSES } }),
    Order.countDocuments({ ...userMatch, status:{ $in:PAID_STATUSES } }),
    Otp24Order.countDocuments({ ...userMatch, status:{ $in:OTP24_PAID_STATUSES } }),
    Otp24Order.countDocuments({ ...userMatch, status:{ $in:OTP24_PAID_STATUSES } }),
    Otp24AppsOrder.countDocuments({ ...userMatch, status:{ $in:APPS_PAID_STATUSES }, refundApplied:{ $ne:true } }),
    Otp24AppsOrder.countDocuments({ ...userMatch, status:{ $in:APPS_PAID_STATUSES }, refundApplied:{ $ne:true } }),
  ]);

  // totalOrders: นับเฉพาะคำสั่งซื้อที่นับเป็นยอดใช้จ่ายจริงเท่านั้น
  // SMM completed/partial + OTP24 success + APPS success ไม่รวม TelegramBot/Bonustime
  const totalOrders = ordAll + otpAll + appsAll;
  const totalOrdersPaid = ordPaid + otpPaid + appsPaid;

  const u = await User.findById(userId)
    .select('totalSpentRaw totalSpent redeemedSpent pointsRedeemed')
    .lean();

  const sourceSpent = await computeAuthoritativeSourceSpent(userId);

  // รวมใหม่แบบ authoritative ทุกครั้ง: ยอดใช้จ่ายจริง = SMM + OTP24 + APPS เท่านั้น
  // ห้ามอิง totalSpentRaw เดิม เพราะเคยมี TelegramBot/ยอดมั่วถูกบวกเข้าไปแล้ว
  const ledgerRaw = positive(sourceSpent.total);
  const redeemedSpent = positive(u?.redeemedSpent);
  const effectiveSpent = positive(ledgerRaw - redeemedSpent);

  const level = computeLevel(effectiveSpent);
  const lvMeta = decideLevel(effectiveSpent);
  const pointsAccrued = calcPoints(effectiveSpent);
  const pointsRedeemed = positive(u?.pointsRedeemed);
  const points = positive(pointsAccrued - pointsRedeemed);
  const pointRateTHB = getRateForLevelIndex(lvMeta.index);
  const pointValueTHB = round2(points * pointRateTHB);

  const [lastPaidOrd, lastPaidOtp, lastPaidApps] = await Promise.all([
    Order.findOne({ ...userMatch, status:{ $in:PAID_STATUSES } }, { updatedAt:1, createdAt:1 }).sort({ updatedAt:-1, createdAt:-1 }).lean(),
    Otp24Order.findOne({ ...userMatch, status:{ $in:OTP24_PAID_STATUSES } }, { updatedAt:1, createdAt:1 }).sort({ updatedAt:-1, createdAt:-1 }).lean(),
    Otp24AppsOrder.findOne({ ...userMatch, status:{ $in:APPS_PAID_STATUSES }, refundApplied:{ $ne:true } }, { updatedAt:1, createdAt:1 }).sort({ updatedAt:-1, createdAt:-1 }).lean(),
  ]);
  const lastPaidAt = new Date(Math.max(
    lastPaidOrd ? +new Date(lastPaidOrd.updatedAt || lastPaidOrd.createdAt) : 0,
    lastPaidOtp ? +new Date(lastPaidOtp.updatedAt || lastPaidOtp.createdAt) : 0,
    lastPaidApps ? +new Date(lastPaidApps.updatedAt || lastPaidApps.createdAt) : 0,
    Date.now()
  ));

  await User.updateOne(
    { _id:userId },
    { $set:{
      totalOrders,
      totalOrdersPaid,
      totalSpentRaw: ledgerRaw,
      totalSpent: effectiveSpent,
      level,
      levelIndex: lvMeta.index,
      levelName: lvMeta.name,
      levelNeed: lvMeta.need,
      nextLevelName: lvMeta.nextName,
      toNextLevel: lvMeta.toNext,
      lastSpentAt: lastPaidAt,
      points,
      pointsAccrued,
      pointRateTHB,
      pointValueTHB,
    } }
  );

  return {
    ok:true,
    deltaApplied: round2(smmDelta + otpDelta + appsDelta + telegramDelta),
    smmDelta,
    otpDelta,
    appsDelta,
    telegramDelta,
    sourceSpent,
    totalOrders,
    totalOrdersPaid,
    totalSpentRaw: ledgerRaw,
    totalSpent: effectiveSpent,
    redeemedSpent,
    level,
    levelInfo: lvMeta,
    points,
    pointsAccrued,
    pointsRedeemed,
    pointRateTHB,
    pointValueTHB,
  };
}


export async function recalcAllUsersTotals(opts = {}) {
  const {
    batchSize = 100,
    force = true,
    fullRescan = true,
    reason = 'manual_all_users_recalc',
    log = false,
  } = opts;

  const cursor = User.find({}, { _id:1, email:1, username:1 }).lean().cursor();
  let total = 0;
  let ok = 0;
  let failed = 0;
  const errors = [];

  for await (const u of cursor) {
    total += 1;
    try {
      await recalcUserTotals(u._id, { force, fullRescan, reason });
      ok += 1;
      if (log && ok % batchSize === 0) console.log(`[spend/recalc-all] ${ok}/${total} users done`);
    } catch (e) {
      failed += 1;
      errors.push({ userId:String(u._id), email:u.email || u.username || '', error:e?.message || String(e) });
      if (errors.length > 20) errors.shift();
    }
  }

  return { ok:true, total, updated:ok, failed, errors };
}

export async function recalcUserTotalSpent(userId, opts = {}) {
  return recalcUserTotals(userId, opts);
}
