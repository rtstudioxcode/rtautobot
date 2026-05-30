// routes/orders.js
import mongoose from 'mongoose';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { computeEffectiveRateEx } from '../lib/pricing.js';
import { ProviderSettings } from '../models/ProviderSettings.js';
import { recalcUserTotals, reconcileUserByOrderEvent } from '../services/spend.js';
import {
  createOrder as providerCreateOrder,
  getOrderStatus,
  cancelOrder as providerCancelOrder,
  getCancelById,
  findCancelsByIds,
  requestRefill as providerRequestRefill,
  getBalance,
} from '../lib/iplusviewAdapter.js';
import { UsageLog } from '../models/UsageLog.js';
import { getRateUnit } from '../lib/rateUnit.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth);

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

const lastRefreshAt = new Map();
const REFRESH_COOLDOWN_MS = 45_000;


// Cost guard: keep SMM history / local polling reads slim.
// Provider raw snapshots can contain huge service descriptions. Loading them on every
// history page/poll creates unnecessary MongoDB traffic and app memory pressure.
const SMM_HISTORY_ORDER_SELECT = [
  '_id user userId service providerServiceId serviceName link comments quantity',
  'estCost cost currency rateAtOrder status providerOrderId progress remains startCount currentCount',
  'refundAmount refundType refundCommitted refundTxId spentAccounted partialRefunds',
  'createdAt updatedAt acceptedAt completedAt canceledAt',
  'meta.country meta.speed',
  'providerResponse.providerOrderId providerResponse.lastStatus',
  'providerResponse.raw.service.name providerResponse.raw.comments providerResponse.raw.comment'
].join(' ');

const SMM_HISTORY_SERVICE_SELECT = [
  'name rate currency providerServiceId refill cancel',
  'details.services.id details.services.name details.services.rate details.services.currency',
  'details.services.providerServiceId details.services.refill details.services.cancel',
  'details.services.step details.services.min details.services.max'
].join(' ');

const SMM_LOCAL_STATUS_SELECT = [
  '_id user status quantity progress remains startCount currentCount updatedAt createdAt refundAmount refundType',
  'providerResponse.lastStatus'
].join(' ');

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────
const toNum = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const nz = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const moneyRound = n => Math.round((Number(n) || 0) * 100) / 100;

// ใช้ map สถานะไทย (ใช้ซ้ำ)
const mapTH = (x='') => ({
  processing: 'รอดำเนินการ',
  pending: 'รอดำเนินการ',
  inprogress: 'กำลังทำ',
  completed:  'เสร็จสิ้น',
  partial:    'ส่วนบางส่วน',
  canceled:   'ยกเลิก',
  canceling:  'กำลังยกเลิก',
}[String(x).toLowerCase()] || x);

/** รวมผลตอบกลับของ provider ให้เข้ากับสคีมาเรา */
function normalizeProviderFields(resp) {
  const r = resp || {};
  return {
    providerOrderId: r.providerOrderId ?? r.order_id ?? r.orderId ?? r.id ?? null,
    startCount:   toNum(r.start_count ?? r.startCount),
    currentCount: toNum(r.current_count ?? r.currentCount),
    remains:      toNum(r.remains),
    progress:     toNum(r.progress),
    acceptedAt:   r.accepted_at ? new Date(r.accepted_at)
                 : (r.acceptedAt ? new Date(r.acceptedAt) : null),
    raw:          r,
  };
}

/** คืนค่า flags {refill, cancel} ของ service (รองรับทั้ง group-child และตัวหลัก) */
function getServiceFlags(serviceDoc, providerServiceId) {
  if (!serviceDoc) return { refill: false, cancel: false };
  let refill = !!serviceDoc.refill;
  let cancel = !!serviceDoc.cancel;

  const children = Array.isArray(serviceDoc?.details?.services)
    ? serviceDoc.details.services : [];
  if (children.length) {
    const child = children.find(c => String(c.id) === String(providerServiceId));
    if (child) {
      if (typeof child.refill === 'boolean') refill = child.refill;
      if (typeof child.cancel === 'boolean') cancel = child.cancel;
    }
  }
  return { refill, cancel };
}

/** คำนวณ % ที่ทำไปแล้ว จาก progress/remains/start-current */
function computeDonePct(o) {
  const qty = Number(o.quantity) || 0;
  if (typeof o.progress === 'number' && Number.isFinite(o.progress)) return Math.max(0, Math.min(100, o.progress));
  if (typeof o.remains === 'number' && Number.isFinite(o.remains) && qty > 0) {
    const left = Math.max(0, o.remains);
    return Math.max(0, Math.min(100, (1 - left / qty) * 100));
  }
  if (typeof o.startCount === 'number' && Number.isFinite(o.startCount) && typeof o.currentCount === 'number' && Number.isFinite(o.currentCount) && qty > 0) {
    const gained = Math.max(0, o.currentCount - o.startCount);
    return Math.max(0, Math.min(100, (gained / qty) * 100));
  }
  return 0;
}

function hasRealSmmCompletionEvidence(order = {}) {
  const qty = Number(order.quantity) || 0;
  const progress = Number(order.progress);
  const remains = Number(order.remains);
  const start = Number(order.startCount);
  const current = Number(order.currentCount);

  if (Number.isFinite(progress) && progress >= 99.995) return true;
  if (qty > 0 && Number.isFinite(remains) && remains <= 0) return true;
  if (qty > 0 && Number.isFinite(start) && Number.isFinite(current) && (current - start) >= qty) return true;
  return false;
}

function normalizeSmmStatusForDisplay(order = {}) {
  const st = String(order.status || '').toLowerCase();
  if (st === 'canceled' || st === 'canceling' || st === 'partial') return st;

  // Terminal status from DB/provider must stay terminal. Numeric detail fields
  // can lag behind; downgrading completed to processing makes the table lie.
  // We normalize completed snapshots to 100%/0 remains before rendering/API.
  if (st === 'completed') return 'completed';

  if (st === 'inprogress') return 'inprogress';
  return 'processing';
}

function normalizeTerminalOrderSnapshot(order = {}) {
  const status = String(order.status || '').toLowerCase();
  if (status !== 'completed') return order;

  const qty = Math.max(0, Number(order.quantity || 0));
  const start = Number(order.startCount);
  const current = Number(order.currentCount);

  const next = { ...order, progress: 100, remains: 0 };
  if (qty > 0 && Number.isFinite(start)) {
    const computedCurrent = start + qty;
    next.currentCount = Number.isFinite(current)
      ? Math.max(current, computedCurrent)
      : computedCurrent;
  }
  return next;
}

function isDone(o) {
  return normalizeSmmStatusForDisplay(o) === 'completed';
}

// คืนเงินแบบ idempotent: คืนเฉพาะ “ส่วนต่าง” ที่ยังไม่เคยคืน
async function refundIdempotent({ userId, orderId, currency = 'THB', amount }) {
  const amt = Math.max(0, Number(amount) || 0);
  if (amt <= 0) return { refunded: 0, already: 0, delta: 0 };

  let already = 0;
  try {
    const agg = await UsageLog.aggregate([
      { $match: { orderId, type: 'refund' } },
      { $group: { _id: '$orderId', sum: { $sum: '$amount' } } }
    ]);
    already = Number(agg?.[0]?.sum || 0);
  } catch {}

  const delta = Math.max(0, amt - already);
  if (delta <= 0) return { refunded: 0, already, delta: 0 };

  let log = null;
  try {
    log = await UsageLog.create({
      userId, orderId, type: 'refund', amount: delta, currency, note: 'cancel/partial refund'
    });
  } catch (e) {
    if (e?.code === 11000) return { refunded: 0, already: amt, delta: 0 };
    throw e;
  }

  await User.updateOne({ _id: userId }, { $inc: { balance: delta } });
  return { refunded: delta, already, delta, logId: log?._id || null };
}

/** อัปเดตยอดเครดิตผู้ให้บริการ (ไม่ throw เพื่อไม่รันค้าง) */
async function refreshProviderBalanceNow() {
  try {
    const balRaw = await getBalance();
    const keys = ['balance', 'credit', 'credits', 'amount'];
    const val = Number(keys.map(k => balRaw?.[k]).find(v => v !== undefined));
    let ps = await ProviderSettings.findOne();
    if (!ps) ps = new ProviderSettings();
    ps.lastBalance = Number.isFinite(val) ? val : 0;
    ps.lastSyncAt = new Date();
    await ps.save();
    glog.log('[balance] synced =>', ps.lastBalance);
  } catch (e) {
    glog.warn('[balance] sync failed:', e?.response?.data || e.message || e);
  }
}

// helper
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));

async function forceCheckProviderAndUpdate(order) {
  const cancelId = order?.meta?.cancelId || order?.cancelId;
  if (cancelId) {
    try {
      const r = await getCancelById(cancelId);
      if (r?.status === 'canceled' || r?.status === 'partial') {
        order.status = (r.status === 'canceled') ? 'canceled' : 'partial';
        if (r?.refundAmount != null) {
          order.refundAmount = Number(r.refundAmount) || 0;
          order.refundType   = (r.status === 'partial') ? 'partial' : 'full';
        }
        order.updatedAt = new Date();
        await order.save();
        await reconcileUserByOrderEvent(order, 'cancel_confirmed');
        return true;
      }
    } catch {}
  }

  try {
    const r2 = await findCancelsByIds([order.providerOrderId].filter(Boolean));
    const hit = Array.isArray(r2) ? r2.find(x => String(x.orderId) === String(order.providerOrderId)) : null;
    if (hit && (hit.status === 'canceled' || hit.status === 'partial')) {
      order.status = (hit.status === 'canceled') ? 'canceled' : 'partial';
      if (hit?.refundAmount != null) {
        order.refundAmount = Number(hit.refundAmount) || 0;
        order.refundType   = (hit.status === 'partial') ? 'partial' : 'full';
      }
      order.updatedAt = new Date();
      await order.save();
      await reconcileUserByOrderEvent(order, 'cancel_confirmed');
      return true;
    }
  } catch {}

  try {
    const s = await getOrderStatus(order.providerOrderId);
    const st = String(s?.status || '').toLowerCase();
    if (st === 'canceled' || st === 'partial') {
      order.status = (st === 'canceled') ? 'canceled' : 'partial';
      if (s?.refundAmount != null) {
        order.refundAmount = Number(s.refundAmount) || 0;
        order.refundType   = (st === 'partial') ? 'partial' : 'full';
      }
      order.updatedAt = new Date();
      await order.save();
      
      // ✅ จุดสำคัญ: เรียก Reconcile เพื่อให้เงินเด้งเข้า balance ทันที
      await reconcileUserByOrderEvent(order._id, { reason: 'cancel_confirmed', force: true });
      return true;
    }
  } catch {}

  return false;
}

// ─────────────────────────────────────────────────────────────
// redirects
// ─────────────────────────────────────────────────────────────
router.get('/my/order', (req, res) => res.redirect(301, '/my/orders'));
router.get('/orders/history', (req, res) => res.redirect(302, '/my/orders'));

// ─────────────────────────────────────────────────────────────
// create order
// ─────────────────────────────────────────────────────────────
router.post('/orders', async (req, res) => {
  try {
    const { serviceId, groupId, providerServiceId, link } = req.body;
    let quantity = nz(req.body.quantity);

    // Comments & Keywords
    const bodyComments = (req.body.comments || '').trim();
    const bodyKeywords = (req.body.keywords || '').trim();

    if (!link || !quantity) {
      return res.status(400).json({ error: 'missing fields' });
    }

    // 0) Auth
    const me = req.session?.user || req.user;
    const userId = String(me?._id || '');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    // 1) หา Service (เดี่ยว หรือ กลุ่ม + child)
    let baseDoc = null;
    let chosen = null;
    let providerIdForApi = null;

    if (serviceId) {
      baseDoc = await Service.findById(serviceId).lean();
      if (!baseDoc) return res.status(404).json({ error: 'service not found' });

      chosen = { ...baseDoc };
      providerIdForApi =
        baseDoc.providerServiceId ||
        baseDoc.providerServiceID ||
        baseDoc.id ||
        baseDoc.provider_id;

    } else if (groupId && providerServiceId) {
      baseDoc = await Service.findById(groupId).lean();
      if (!baseDoc) return res.status(404).json({ error: 'service group not found' });

      const children = Array.isArray(baseDoc?.details?.services)
        ? baseDoc.details.services
        : [];

      const child = children.find(c => String(c.id) === String(providerServiceId));
      if (!child) return res.status(404).json({ error: 'child service not found' });

      chosen = {
        ...child,
        _id: baseDoc._id,
        category: baseDoc.category,
        subcategory: baseDoc.subcategory,
        currency: child.currency || baseDoc.currency || 'THB',
        rate: nz(child.rate ?? baseDoc.rate),
        min: nz(child.min ?? baseDoc.min),
        max: nz(child.max ?? baseDoc.max),
        step: nz(child.step ?? baseDoc.step ?? 1),
        name: child.name || baseDoc.name
      };

      providerIdForApi = child.id;

    } else {
      return res.status(400).json({ error: 'missing fields' });
    }

    // 2) ตรวจ min/max/step
    if (!(quantity > 0)) return res.status(400).json({ error: 'จำนวนต้องมากกว่า 0' });
    if (chosen.min && quantity < chosen.min)
      return res.status(400).json({ error: `ขั้นต่ำ ${chosen.min}` });
    if (chosen.max && quantity > chosen.max)
      return res.status(400).json({ error: `สูงสุด ${chosen.max}` });

    const stepUnit = Math.max(1, nz(chosen.step)); // unit/step ที่ DB กำหนด
    if (quantity % stepUnit !== 0) {
      const fixed = Math.floor(quantity / stepUnit) * stepUnit;
      if (fixed < Math.max(1, nz(chosen.min))) {
        return res.status(400).json({ error: `ปริมาณต้องเป็นทวีคูณของ ${stepUnit}` });
      }
      quantity = fixed;
    }

    // 3) pricing + คิดราคา (single service)
    const baseRate = nz(chosen.rate);
    let effectiveRate = baseRate;
    const rateUnit = getRateUnit(providerIdForApi);

    try {
      const ex = await computeEffectiveRateEx({
        serviceId: chosen._id,
        userId: req.user._id,
        baseRate
      });
      effectiveRate = Number(ex.finalRate ?? baseRate);
    } catch {
      effectiveRate = baseRate; // fallback
    }

    // ✅ สูตรคิดเงินจริง (สำคัญ)
    // quantity / rateUnit * rate
    const cost = moneyRound(
      (quantity / rateUnit) * effectiveRate
    );

    const currency = chosen.currency || 'THB';

    // 4) ตัดเงิน
    const debited = await User.findOneAndUpdate(
      { _id: userId, balance: { $gte: cost } },
      { $inc: { balance: -cost } },
      { new: true, projection: { balance: 1 } }
    );
    if (!debited)
      return res.status(400).json({ error: 'ยอดเงินไม่พอ', need: cost, currency });

    // 5) เตรียม payload ส่ง Provider
    const providerPayload = {
      service_id: Number(providerIdForApi),
      link,
      quantity,
      ...(req.body?.dripfeed !== undefined ? { dripfeed: !!req.body.dripfeed } : {}),
      ...(req.body?.runs !== undefined ? { runs: Number(req.body.runs) } : {}),
      ...(req.body?.interval !== undefined ? { interval: String(req.body.interval) } : {})
    };

    // === รวม comments + keywords ===
    let combinedComments = null;
    if (bodyComments && bodyKeywords) combinedComments = `${bodyComments} | ${bodyKeywords}`;
    else if (bodyComments) combinedComments = bodyComments;
    else if (bodyKeywords) combinedComments = bodyKeywords;
    if (combinedComments) providerPayload.comments = combinedComments;

    const baseFields = {
      user: userId,
      userId,
      service: baseDoc._id,
      providerServiceId: providerIdForApi,
      link,
      quantity,
      cost,
      estCost: cost,
      currency,
      rateAtOrder: effectiveRate,
      rateUnitAtOrder: rateUnit,
      baseRateAtOrder: nz(chosen.rate),
      serviceName: chosen.name || baseDoc.name,
      status: 'pending',
      providerResponse: null,
      category: baseDoc.category,
      subcategory: baseDoc.subcategory
    };
    if (bodyComments) baseFields.comments = bodyComments;
    if (bodyKeywords) baseFields.keywords = bodyKeywords;

    // 6) สร้าง local order ก่อนยิง provider เพื่อลดเคส provider สำเร็จแต่ DB fail
    let order;
    try {
      order = await Order.create(baseFields);
    } catch (e) {
      await User.updateOne({ _id: userId }, { $inc: { balance: cost } });
      glog.error('Order pre-create failed, refunded:', e);
      return res.status(500).json({ error: 'save order failed' });
    }

    // 7) ยิง Provider
    let providerResp;
    try {
      providerResp = await providerCreateOrder(providerPayload);
    } catch (e) {
      glog.error('Provider order failed:', e?.response?.data || e.message);

      // Provider ไม่รับงาน: คืนเครดิตทันทีและ mark committed เพื่อไม่ให้ repair/reconcile คืนซ้ำ
      let refundResult = null;
      try {
        refundResult = await refundIdempotent({
          userId,
          orderId: order._id,
          currency,
          amount: cost,
        });
      } catch (refundErr) {
        glog.error('Provider failed refund error:', refundErr?.message || refundErr);
      }

      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            status: 'failed',
            providerResponse: e?.response?.data || { error: e?.message || String(e) },
            refundAmount: cost,
            refundType: 'full',
            refundCommitted: true,
            refundTxId: refundResult?.logId ? String(refundResult.logId) : null,
            spentAccounted: 0,
            spentAccountedAt: new Date(),
            updatedAt: new Date(),
          }
        }
      );

      return res.status(502).json({
        error: 'สั่งงานผู้ให้บริการไม่สำเร็จ',
        detail: e?.response?.data || e.message
      });
    }

    // 8) Normalize response และ update local order
    const np = normalizeProviderFields(providerResp);
    const updateFields = {
      providerOrderId: np.providerOrderId,
      status: 'processing',
      providerResponse: np.raw || providerResp || null,
      startCount: np.startCount ?? undefined,
      currentCount: np.currentCount ?? undefined,
      remains: np.remains ?? undefined,
      progress: np.progress ?? undefined,
      acceptedAt: np.acceptedAt || undefined,
    };

    if (
      updateFields.progress == null &&
      updateFields.startCount != null &&
      updateFields.currentCount != null &&
      quantity > 0
    ) {
      updateFields.progress = round2(
        Math.max(0, Math.min(100, ((updateFields.currentCount - updateFields.startCount) / quantity) * 100))
      );
    }

    try {
      order = await Order.findByIdAndUpdate(order._id, { $set: updateFields }, { new: true });
      await User.updateOne({ _id: userId }, { $inc: { totalOrders: 1 } });

      setTimeout(() => {
        refreshProviderBalanceNow().catch(() => {});
        reconcileUserByOrderEvent(order._id).catch(() => {});
      }, 0);

      return res.json({
        ok: true,
        orderId: order._id,
        providerOrderId: np.providerOrderId,
        charged: { amount: cost, currency },
        balance: debited.balance,
        rateUnit: rateUnit,
        rate: effectiveRate,
        quantity: quantity,
        totalCost: cost
      });
    } catch (e) {
      // มี local order อยู่แล้วและ provider อาจรับงานแล้ว: ห้ามคืนเครดิตอัตโนมัติแบบเงียบ ๆ
      // เพื่อไม่ให้เจ้าของเว็บเสียต้นทุน ให้ mark pending ไว้ให้แอดมินตาม providerResponse ใน log ได้
      glog.error('Order provider update failed; local order preserved:', e);
      return res.status(202).json({
        ok: true,
        warning: 'provider accepted but local update needs admin review',
        orderId: order._id,
        providerOrderId: np.providerOrderId,
        charged: { amount: cost, currency },
        balance: debited.balance,
      });
    }
  } catch (err) {
    glog.error('POST /orders error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// my orders (ส่ง flag ไปให้ history.ejs ใช้แสดง/ซ่อนปุ่ม)
// ─────────────────────────────────────────────────────────────
router.get('/my/orders', requireAuth, async (req, res, next) => {
  try {
    const me = req.user || res.locals.me || req.session?.user;
    if (!me || !me._id) return res.redirect('/login');

    const userId = String(me._id);
    const {
      from,
      to,
      q = '',
      status = 'all',
    } = req.query || {};

    const find = { user: userId };

    if (from || to) {
      find.createdAt = {};
      if (from) find.createdAt.$gte = new Date(from + 'T00:00:00.000Z');
      if (to)   find.createdAt.$lte = new Date(to   + 'T23:59:59.999Z');
    }

    if (status && status !== 'all') {
      find.status = String(status).toLowerCase();
    }

    if (q && q.trim()) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx   = new RegExp(safe, 'i');
      find.$or = [
        { providerOrderId: q },
        { link: rx },
        { serviceName: rx },
      ];
      if (mongoose.isValidObjectId(q)) {
        find.$or.push({ _id: q });
      }
    }

    const total = await Order.countDocuments(find);

    const PERPAGE_OPTIONS = [10,20,50,100,250,500,1000];
    const perPageRaw = String(req.query.perPage ?? '20').toLowerCase();

    let perPage;
    if (perPageRaw === 'all') {
      perPage = total || 1_000_000;
    } else {
      const n = Math.max(1, parseInt(perPageRaw,10) || 20);
      perPage = PERPAGE_OPTIONS.includes(n) ? n : 20;
    }

    const pages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
    let page    = Math.max(1, parseInt(req.query.page || '1', 10));
    if (page > pages) page = pages;

    const skip = (page - 1) * perPage;

    const list = await Order.find(find)
      .select(SMM_HISTORY_ORDER_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    const serviceIds = [...new Set(list.map(o => o?.service).filter(Boolean).map(String))];
    const services = serviceIds.length
      ? await Service.find({ _id: { $in: serviceIds } })
          .select(SMM_HISTORY_SERVICE_SELECT)
          .lean()
      : [];
    const servicesWithUnit = services.map(s => {
      const base = {
        ...s,
        rateUnit: getRateUnit(s.providerServiceId)
      };

      if (Array.isArray(s?.details?.services)) {
        base.details = {
          ...s.details,
          services: s.details.services.map(child => ({
            ...child,
            rateUnit: getRateUnit(child.id)
          }))
        };
      }

      return base;
    });

    // 🔁 ใช้ตัวใหม่แทน
    const svcMap = Object.fromEntries(
      servicesWithUnit.map(s => [String(s._id), s])
    );

    const listWithSvc = list.map(o => {
      const svc = svcMap[String(o.service)] || null;
      const flags = getServiceFlags(svc, o.providerServiceId);
      const displayStatus = normalizeSmmStatusForDisplay(o);
      const displaySnapshot = normalizeTerminalOrderSnapshot({
        ...o,
        status: displayStatus,
      });
      const displayOrder = { ...displaySnapshot, status: displayStatus };
      const _isDone = isDone(displayOrder);
      const rawStatus = String(o.providerResponse?.lastStatus?.rawStatus || '').toLowerCase();
      return {
        ...o,
        rawDbStatus: o.status,
        status: displayStatus,
        startCount: displaySnapshot.startCount,
        currentCount: displaySnapshot.currentCount,
        remains: displaySnapshot.remains,
        progress: displaySnapshot.progress,
        service: svc ? {
          _id: svc._id,
          name: svc.name,
          rate: svc.rate,
          currency: svc.currency,
          providerServiceId: svc.providerServiceId,

          rateUnit: getRateUnit(o.providerServiceId)
        } : null,
        uiFlags: {
          canCancel: (flags.cancel === true || rawStatus === 'pending') && !_isDone && !!o.providerOrderId,
          canRefill: (flags.refill === true) && _isDone && !!o.providerOrderId,
          isDone: _isDone
        }
      };
    });

    const pillClass = (s = '') => {
      s = String(s).toLowerCase();
      if (s === 'processing') return 'warn';
      if (s === 'pending') return 'warn';
      if (s === 'inprogress') return 'blue';
      if (s === 'completed')  return 'ok';
      if (s === 'partial')    return 'violet';
      if (s === 'canceled')   return 'danger';
      return '';
    };
    const thStatus = (s = '') =>
      ({ processing:'รอดำเนินการ', pending:'รอดำเนินการ', inprogress:'กำลังทำ', completed:'เสร็จสิ้น', partial:'คืนบางส่วน', canceled:'ยกเลิก' }[String(s).toLowerCase()] || s);

    res.render('orders/history', {
      list: listWithSvc,
      from,
      to,
      q,
      status,
      pillClass,
      thStatus,
      title: 'ประวัติการใช้บริการ Social',
      bodyClass: 'orders-wide',
      syncError: req.flash?.('syncError')?.[0] || '',
      showMyOrdersNav: true,
      page,
      perPage,
      total
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// single order status (GET) + refresh (POST)
// ─────────────────────────────────────────────────────────────
router.get('/orders/:id/status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'not found' });
    const me = req.user || req.session?.user;
    const meId = String(me?._id || me?.id || '');
    if (String(order.userId || order.user || '') !== meId) {
      const isAdmin = me?.role === 'admin' || me?.isAdmin;
      if (!isAdmin) return res.status(403).json({ error: 'forbidden' });
    }

    if (!order.providerOrderId) {
      return res.json({ ok: true, status: order.status });
    }

    const s = await getOrderStatus(order.providerOrderId);
    const st = String(s.status || order.status || 'processing').toLowerCase();

    const u = {
      status: st,
      startCount:   toNum(s.start_count ?? s.startCount)   ?? order.startCount,
      currentCount: toNum(s.current_count ?? s.currentCount) ?? order.currentCount,
      remains:      toNum(s.remains) ?? order.remains,
      progress:     toNum(s.progress) ?? order.progress,
      acceptedAt:   s.accepted_at ? new Date(s.accepted_at)
                   : (s.acceptedAt ? new Date(s.acceptedAt) : (order.acceptedAt || null)),
      providerResponse: { ...(order.providerResponse || {}), lastStatus: s },
    };
    if (u.progress == null && u.startCount != null && u.currentCount != null && order.quantity > 0) {
      u.progress = Math.max(0, Math.min(100, ((u.currentCount - u.startCount) / order.quantity) * 100));
    }

    Object.assign(order, u);
    await order.save();
    setTimeout(() => reconcileUserByOrderEvent(order._id).catch(()=>{}), 0);

    return res.json({ ok: true, rawDbStatus: order.status, status: normalizeSmmStatusForDisplay(order), provider: s });
  } catch (err) {
    glog.error('GET /orders/:id/status error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

router.post('/api/orders/:id/refresh', async (req, res) => {
  try {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });

    const mapTHL = (x='') => ({
      processing:'รอดำเนินการ', pending:'รอดำเนินการ', inprogress:'กำลังทำ', completed:'เสร็จสิ้น',
      partial:'ส่วนบางส่วน', canceled:'ยกเลิก', canceling:'กำลังยกเลิก'
    }[String(x).toLowerCase()] || x);

    if (String(o.status||'').toLowerCase() === 'canceling' && o.lastCancelId) {
      try {
        const c = await getCancelById(o.lastCancelId);
        const st = String(c.status || '').toLowerCase();

        if (/^(canceled|cancelled|success|ok|accepted|done|finished|completed)$/.test(st)) {
          const est0 = nz(o.estCost ?? o.cost);
          const est  = Math.max(0, Number(est0) || 0);
          const donePct   = computeDonePct(o);
          const leftRatio = Math.max(0, Math.min(1, 1 - (donePct/100)));
          const refund    = round2(est * leftRatio);
          const refundType = (leftRatio >= 0.999) ? 'full'
                            : (leftRatio <= 0.001) ? 'none' : 'partial';

          o.status = 'canceled';
          o.canceledAt = new Date();
          o.refundAmount = refund;
          o.refundType = (refundType === 'none') ? null : refundType;
          await o.save();

          if (refund > 0) {
            // 🔥 ไม่ต้องสั่ง update balance เองแล้ว เพราะใน spend.js (reconcileOrderSpend) 
            // ที่เราแก้ใหม่ มีคำสั่ง $inc: { balance: refundAmount } อยู่ในนั้นแล้ว
            // การเรียกใช้ฟังก์ชันนี้ที่เดียว จะได้ทั้ง เงินคืน + ปรับยอดสะสม + ปรับเลเวล ให้จบในทีเดียว
            await reconcileUserByOrderEvent(o._id, { force: true, reason: 'api_refresh_refund' });
          }
          setTimeout(() => reconcileUserByOrderEvent(o._id).catch(()=>{}), 0);

          return res.json({
            ok: true,
            status: o.status,
            status_th: mapTHL(o.status),
            refundAmount: o.refundAmount ?? 0,
            refundType: o.refundType || null,
            updatedAt: o.updatedAt,
            progress: o.progress ?? null,
            remains: o.remains ?? null,
            start_count: o.startCount ?? null,
            current_count: o.currentCount ?? null
          });
        }
      } catch (e) {
        glog.warn('check cancel status failed:', e?.response?.data || e.message);
      }
    }

    if (!o.providerOrderId) {
      return res.json({ ok: true, rawDbStatus: o.status, status: normalizeSmmStatusForDisplay(o) || 'processing' });
    }

    const s  = await getOrderStatus(o.providerOrderId);
    const st = String(s.status || o.status || 'processing').toLowerCase();

    const upd = {
      status: st,
      startCount:   toNum(s.start_count ?? s.startCount)     ?? o.startCount,
      currentCount: toNum(s.current_count ?? s.currentCount) ?? o.currentCount,
      remains:      toNum(s.remains) ?? o.remains,
      progress:     toNum(s.progress) ?? o.progress,
      acceptedAt:   s.accepted_at ? new Date(s.accepted_at)
                   : (s.acceptedAt ? new Date(s.acceptedAt) : (o.acceptedAt || null)),
      providerResponse: { ...(o.providerResponse || {}), lastStatus: s },
      updatedAt: new Date()
    };
    if (upd.progress == null && upd.startCount != null && upd.currentCount != null && o.quantity > 0) {
      upd.progress = Math.max(0, Math.min(100, ((upd.currentCount - upd.startCount) / o.quantity) * 100));
    }

    const prevStatus = o.status; 
    Object.assign(o, upd);   
    await o.save();
    setTimeout(() => reconcileUserByOrderEvent(o._id).catch(()=>{}), 0);

    if (st === 'canceled' && prevStatus !== 'canceled') {
      const est0 = nz(o.estCost ?? o.cost);
      const est  = Math.max(0, Number(est0) || 0);
      const donePct   = computeDonePct(o);     
      const leftRatio = Math.max(0, Math.min(1, 1 - (donePct/100)));
      const refund    = round2(est * leftRatio);
      const refundType = (leftRatio >= 0.999) ? 'full'
                        : (leftRatio <= 0.001) ? 'none' : 'partial';

      o.status = 'canceled';
      o.canceledAt = new Date();
      if (!Number.isFinite(o.refundAmount) || o.refundAmount <= 0) {
        o.refundAmount = refund;
        o.refundType = refundType;
        await o.save();
        if (refund > 0) {
          // 🔥 ใช้คำสั่งนี้แทนการ update balance เอง
          // ฟังก์ชันนี้จะไปเรียก spend.js เพื่อคำนวณส่วนต่าง (Delta) 
          // และคืนเงินเข้า balance พร้อมลดกำไร/ยอดสะสมให้ถูกต้องในที่เดียว
          await reconcileUserByOrderEvent(o._id, { force: true, reason: 'api_manual_refresh' });
        }
      } else {
        await o.save();
      }
    }

    const displayStatus = normalizeSmmStatusForDisplay(o);
    const snap = normalizeTerminalOrderSnapshot({
      status: displayStatus,
      quantity: o.quantity,
      startCount: o.startCount,
      currentCount: o.currentCount,
      remains: o.remains,
      progress: o.progress,
    });
    return res.json({
      ok: true,
      rawDbStatus: o.status,
      status: displayStatus,
      status_th: mapTHL(displayStatus),
      refundAmount: o.refundAmount ?? 0,
      refundType: o.refundType || null,
      updatedAt: o.updatedAt,
      progress: snap.progress ?? null,
      remains: snap.remains ?? null,
      start_count: snap.startCount ?? null,
      current_count: snap.currentCount ?? null
    });
  } catch (err) {
    glog.error('POST /api/orders/:id/refresh error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// refresh-all
// ─────────────────────────────────────────────────────────────
router.post('/api/orders/refresh-all', async (req, res) => {
  try {
    const me = req.session?.user || req.user;
    const userId = String(me?._id || '');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const prev = lastRefreshAt.get(userId) || 0;
    const now  = Date.now();
    if (now - prev < REFRESH_COOLDOWN_MS) {
      return res.json({ ok: true, updated: 0, changes: [], cooldown: true });
    }
    lastRefreshAt.set(userId, now);

    const list = await Order.find({
      user: userId,
      status: { $in: ['processing', 'pending', 'inprogress', 'partial', 'canceling'] }
    }).sort({ createdAt: -1 }).limit(300);

    let updated = 0;
    const changes = [];

    const canceling = list.filter(o =>
      String(o.status).toLowerCase() === 'canceling' && o.lastCancelId
    );
    const cancelIds = canceling.map(o => String(o.lastCancelId));

    let cancelMap = {};
    if (cancelIds.length) {
      try {
        const arr = await findCancelsByIds(cancelIds);
        cancelMap = Object.fromEntries(arr
          .filter(x => x && x.id)
          .map(x => [String(x.id), x]));
      } catch (e) {
        glog.warn('findCancelsByIds failed:', e?.response?.data || e.message);
      }
    }

    for (const o of list) {
      const curSt = String(o.status || '').toLowerCase();

      if (curSt === 'canceling' && o.lastCancelId) {
        const c = cancelMap[String(o.lastCancelId)];
        if (c) {
          const st = String(c.status || '').toLowerCase();
          if (/^(canceled|cancelled|success|ok|accepted|done|finished|completed)$/.test(st)) {
            const est0 = nz(o.estCost ?? o.cost);
            const est  = Math.max(0, Number(est0) || 0);
            const donePct   = computeDonePct(o);
            const leftRatio = Math.max(0, Math.min(1, 1 - (donePct / 100)));
            const refund    = round2(est * leftRatio);
            const refundType = (leftRatio >= 0.999) ? 'full'
                              : (leftRatio <= 0.001) ? 'none' : 'partial';

            o.status = 'canceled';
            o.canceledAt = new Date();
            if (!Number.isFinite(o.refundAmount) || o.refundAmount <= 0) {
              o.refundAmount = refund;
              o.refundType = (refundType === 'none') ? null : refundType;
              await o.save();
              if (refund > 0) {
                // 🔥 ใช้คำสั่งนี้แทนการ update balance เอง
                // ฟังก์ชันนี้จะไปเรียก spend.js เพื่อคำนวณส่วนต่าง (Delta) 
                // และคืนเงินเข้า balance พร้อมลดกำไร/ยอดสะสมให้ถูกต้องในที่เดียว
                await reconcileUserByOrderEvent(o._id, { force: true, reason: 'api_manual_refresh' });
              }
            } else {
              await o.save();
            }

            updated++;
            changes.push({
              _id: String(o._id),
              status: o.status,
              startCount: o.startCount ?? null,
              currentCount: o.currentCount ?? null,
              remains: o.remains ?? null,
              progress: o.progress ?? null,
              quantity: o.quantity ?? 0,
              updatedAt: o.updatedAt,
              refundAmount: o.refundAmount ?? 0,
              refundType: o.refundType || null
            });
          }
        }
        continue;
      }

      if (!o.providerOrderId) continue;

      try {
        const s  = await getOrderStatus(o.providerOrderId);
        let st   = String(s.status || o.status || 'processing').toLowerCase();

        if (String(o.status).toLowerCase() === 'canceling') {
          st = 'canceling';
        }

        const upd = {
          status: st,
          startCount:   toNum(s.start_count ?? s.startCount)     ?? o.startCount,
          currentCount: toNum(s.current_count ?? s.currentCount) ?? o.currentCount,
          remains:      toNum(s.remains) ?? o.remains,
          progress:     toNum(s.progress) ?? o.progress,
          acceptedAt:   s.accepted_at ? new Date(s.accepted_at)
                       : (s.acceptedAt ? new Date(s.acceptedAt) : (o.acceptedAt || null)),
          providerResponse: { ...(o.providerResponse || {}), lastStatus: s },
          updatedAt: new Date()
        };
        if (upd.progress == null && upd.startCount != null && upd.currentCount != null && o.quantity > 0) {
          upd.progress = Math.max(0, Math.min(100, ((upd.currentCount - upd.startCount) / o.quantity) * 100));
        }

        const before = {
          status: o.status,
          startCount: o.startCount,
          currentCount: o.currentCount,
          remains: o.remains,
          progress: o.progress
        };

        const prevStatus = o.status;
        Object.assign(o, upd);
        await o.save();

        const changed =
          before.status !== o.status ||
          before.startCount !== o.startCount ||
          before.currentCount !== o.currentCount ||
          before.remains !== o.remains ||
          before.progress !== o.progress;

        if (changed) {
          updated++;
          const displayStatus = normalizeSmmStatusForDisplay(o);
          const snap = normalizeTerminalOrderSnapshot({
            status: displayStatus,
            quantity: o.quantity,
            startCount: o.startCount,
            currentCount: o.currentCount,
            remains: o.remains,
            progress: o.progress,
          });
          changes.push({
            _id: String(o._id),
            rawDbStatus: o.status,
            status: displayStatus,
            startCount: snap.startCount ?? null,
            currentCount: snap.currentCount ?? null,
            remains: snap.remains ?? null,
            progress: snap.progress ?? null,
            quantity: o.quantity ?? 0,
            updatedAt: o.updatedAt
          });
        }
      } catch {
        // เงียบไว้
      }
    }

    setTimeout(() => recalcUserTotals(userId, { force: true }).catch(() => {}), 0);

    const RECENT_WINDOW_MS = 10 * 60 * 1000; // 10 นาที
    const recent = await Order.find({
      user: userId,
      updatedAt: { $gte: new Date(Date.now() - RECENT_WINDOW_MS) }
    })
      .select('_id status startCount currentCount remains progress quantity updatedAt refundAmount refundType')
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean();

    for (const r of recent) {
      if (!changes.find(c => String(c._id) === String(r._id))) {
        const displayStatus = normalizeSmmStatusForDisplay(r);
        const snap = normalizeTerminalOrderSnapshot({
          status: displayStatus,
          quantity: r.quantity,
          startCount: r.startCount,
          currentCount: r.currentCount,
          remains: r.remains,
          progress: r.progress,
        });
        changes.push({
          _id: String(r._id),
          rawDbStatus: r.status,
          status: displayStatus,
          startCount: snap.startCount ?? null,
          currentCount: snap.currentCount ?? null,
          remains: snap.remains ?? null,
          progress: snap.progress ?? null,
          quantity: r.quantity ?? 0,
          updatedAt: r.updatedAt,
          refundAmount: r.refundAmount ?? 0,
          refundType: r.refundType || null,
        });
      }
    }

    return res.json({ ok: true, updated, changes });
  } catch (err) {
    glog.error('POST /api/orders/refresh-all error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// NEW: cancel (สั่งยกเลิก → ตั้ง canceling) และ refill
// ─────────────────────────────────────────────────────────────
router.post('/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user || req.session?.user;

    const ord = await Order.findById(id).populate('user', 'username role').exec();
    if (!ord) return res.status(404).json({ ok:false, error:'ไม่พบออเดอร์' });

    const isOwner = String(ord.user?._id || ord.userId || '') === String(me?._id || me?.id || '');
    const isAdmin = me?.role === 'admin';
    if (!(isOwner || isAdmin)) return res.status(403).json({ ok:false, error:'forbidden' });

    const st = String(ord.status || '').toLowerCase();
    if (['canceled','cancelled','completed','partial'].includes(st)) {
      return res.status(400).json({ ok:false, error:`สถานะ "${st}" ไม่สามารถยกเลิกได้` });
    }

    let cancelId = null;
    if (ord.providerOrderId) {
      try {
        const resp = await providerCancelOrder(ord.providerOrderId);
        cancelId = resp?.cancelId ?? null;
      } catch (e) {
        const msg = e?.response?.data?.error || e?.response?.data?.message || e.message || 'cancel denied by provider';
        return res.status(400).json({ ok:false, error: msg });
      }
    }

    ord.status = 'canceling';
    ord.cancelInfo = {
      providerCancelId: cancelId || null,
      requestedAt: new Date(),
      providerStatus: cancelId ? 'pending' : 'requested',
    };
    ord.lastCancelId = cancelId || ord.lastCancelId || null;

    ord.canceledAt   = null;
    ord.refundAmount = null;
    ord.refundType   = null;

    await ord.save();
    return res.json({ ok:true, status: 'canceling', cancelId: ord.cancelInfo.providerCancelId });
  } catch (e) {
    glog.error('cancel order error:', e);
    return res.status(500).json({ ok:false, error:e.message || 'cancel failed' });
  }
});

router.post('/orders/:id/cancel/refresh', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user || req.session?.user;

    const ord = await Order.findById(id).exec();
    if (!ord) return res.status(404).json({ ok:false, error:'ไม่พบออเดอร์' });

    const isOwner = String(ord.user) === String(me?._id || '');
    const isAdmin = me?.role === 'admin';
    if (!(isOwner || isAdmin)) return res.status(403).json({ ok:false, error:'forbidden' });

    if (String(ord.status||'').toLowerCase() === 'canceled') {
      return res.json({ ok:true, updated:false, providerStatus: ord.cancelInfo?.providerStatus || 'done' });
    }

    const cancelId = ord?.cancelInfo?.providerCancelId || ord?.lastCancelId || null;
    if (!cancelId) {
      return res.status(400).json({ ok:false, error:'ยังไม่เคยส่งคำขอยกเลิก' });
    }

    ord.cancelInfo = ord.cancelInfo || { providerCancelId: cancelId, requestedAt: ord.createdAt || new Date() };

    let c;
    try {
      c = await getCancelById(cancelId);
    } catch {
      ord.cancelInfo.providerStatus = 'pending';
      await ord.save();
      return res.json({ ok:true, updated:false, providerStatus: 'pending' });
    }

    const provStatus = String(c?.status || '').toLowerCase();
    const DONE = /^(canceled|cancelled|success|ok|accepted|done|finished|completed|partial)$/i;

    if (!DONE.test(provStatus)) {
      ord.cancelInfo.providerStatus = provStatus || 'pending';
      if (String(ord.status||'').toLowerCase() !== 'canceling') ord.status = 'canceling';
      await ord.save();
      return res.json({ ok:true, updated:false, providerStatus: provStatus || 'pending' });
    }

    const est0   = nz(ord.estCost ?? ord.cost);
    const est    = Math.max(0, Number(est0) || 0);
    const donePct   = computeDonePct(ord);
    const leftRatio = Math.max(0, Math.min(1, 1 - (donePct/100)));
    const computed  = round2(est * leftRatio);

    let shouldRefund = Number.isFinite(+c?.amount) ? +c.amount : computed;
    shouldRefund = Math.max(0, Math.min(shouldRefund, est));

    let finalStatus = 'canceled';
    if (shouldRefund > 0 && shouldRefund < est) finalStatus = 'partial';

    const { delta, logId } = await refundIdempotent({
      userId: ord.user,
      orderId: ord._id,
      currency: ord.currency || 'THB',
      amount: shouldRefund
    });

    ord.status = finalStatus;
    ord.canceledAt = new Date();
    ord.refundAmount = shouldRefund;
    ord.refundType = (shouldRefund >= est - 1e-6) ? 'full' : (shouldRefund > 0 ? 'partial' : null);
    if (shouldRefund > 0) {
      ord.refundCommitted = true;
      if (logId) ord.refundTxId = String(logId);
    }
    ord.cancelInfo.providerStatus = provStatus || 'done';
    ord.cancelInfo.confirmedAt = new Date();
    await ord.save();

    setTimeout(() => reconcileUserByOrderEvent(ord._id).catch(()=>{}), 0);

    return res.json({
      ok:true,
      updated:true,
      providerStatus: provStatus || 'done',
      order: {
        status: ord.status,
        refundAmount: ord.refundAmount,
        refundType: ord.refundType,
        refundDelta: delta
      }
    });
  } catch (e) {
    glog.error('cancel refresh error:', e);
    return res.status(500).json({ ok:false, error:e.message || 'cancel refresh failed' });
  }
});

router.post('/api/orders/:id/cancel/start', async (req, res) => {
  try {
    const me = req.session?.user || req.user;
    const userId = String(me?._id || '');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });

    const isOwner = (String(o.user) === userId || String(o.userId) === userId);
    const isAdmin = String(me?.role || '').toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });

    if (String(o.status || '').toLowerCase() === 'canceled') {
      return res.json({ ok: true, already: true, status: 'canceled', status_th: mapTH('canceled'),
        refundAmount: o.refundAmount || 0, refundType: o.refundType || null });
    }

    const svc = await Service.findById(o.service).lean();
    const { cancel } = getServiceFlags(svc, o.providerServiceId);
    if (!cancel) return res.status(400).json({ error: 'บริการนี้ไม่รองรับการยกเลิก' });

    let cancelId = null;
    if (o.providerOrderId) {
      try {
        const resp = await providerCancelOrder(o.providerOrderId);
        cancelId = resp?.cancelId ?? null;
      } catch (e) {
        glog.warn('provider cancel error:', e?.response?.data || e.message);
      }
    }

    o.status = 'canceling';
    if (cancelId) o.lastCancelId = cancelId;
    o.updatedAt = new Date();
    await o.save();

    return res.json({ ok:true, status:'canceling', status_th: mapTH('canceling'), cancelId });
  } catch (err) {
    glog.error('POST /api/orders/:id/cancel/start error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

router.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const me = req.session?.user || req.user;
    const userId = String(me?._id || '');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });

    const isOwner = (String(o.user) === userId || String(o.userId) === userId);
    const isAdmin = String(me?.role || '').toLowerCase() === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'forbidden' });

    if (String(o.status || '').toLowerCase() === 'canceled') {
      return res.json({
        ok: true, already: true,
        status: 'canceled', status_th: mapTH('canceled'),
        refundAmount: o.refundAmount || 0, refundType: o.refundType || null
      });
    }

    const svc = await Service.findById(o.service).lean();
    const { cancel } = getServiceFlags(svc, o.providerServiceId);
    if (!cancel) return res.status(400).json({ error: 'บริการนี้ไม่รองรับการยกเลิก' });

    let cancelId = null;
    if (o.providerOrderId) {
      try {
        const resp = await providerCancelOrder(o.providerOrderId);
        cancelId = resp?.cancelId ?? null;
      } catch (e) {
        glog.warn('provider cancel error:', e?.response?.data || e.message);
      }
    }

    o.cancelRequestedAt = new Date();
    o.cancelRequestedBy = userId;
    o.cancelProgressAtRequest = (typeof o.progress === 'number') ? o.progress : null;

    o.status = 'canceling';
    if (cancelId) o.lastCancelId = cancelId;
    o.updatedAt = new Date();
    await o.save();

    return res.json({
      ok: true,
      status: 'canceling',
      status_th: mapTH('canceling'),
      cancelId
    });
  } catch (err) {
    glog.error('POST /api/orders/:id/cancel error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

router.post('/api/orders/:id/refill', async (req, res) => {
  try {
    const me = req.session?.user || req.user;
    const userId = String(me?._id || '');
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: 'not found' });
    if (String(o.user) !== userId && String(o.userId) !== userId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const svc = await Service.findById(o.service).lean();
    const { refill } = getServiceFlags(svc, o.providerServiceId);
    if (!refill) return res.status(400).json({ error: 'บริการนี้ไม่รองรับเติมคืน (Refill)' });
    if (!o.providerOrderId) return res.status(400).json({ error: 'ไม่มีหมายเลขออเดอร์ของผู้ให้บริการ' });

    const st = String(o.status || '').toLowerCase();
    if (!(st === 'completed' || st === 'partial')) {
      return res.status(400).json({ error: 'สถานะปัจจุบันไม่รองรับการเติมคืน' });
    }

    let resp = null;
    try {
      resp = await providerRequestRefill(o.providerOrderId);
    } catch (e) {
      glog.error('Provider refill failed:', e?.response?.data || e.message);
      return res.status(502).json({ error: 'ผู้ให้บริการปฏิเสธการเติมคืน', detail: e?.response?.data || e.message });
    }

    await Order.updateOne({ _id: o._id }, {
      $set: {
        lastRefillAt: new Date(),
        lastRefillResponse: resp || null
      },
      $inc: { refillCount: 1 }
    });

    return res.json({ ok: true, provider: resp || { ok: true } });
  } catch (err) {
    glog.error('POST /api/orders/:id/refill error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/**
 * Long-poll endpoint: รอผลยกเลิกให้จริงก่อนค่อยตอบ
 */
router.post('/orders/:id/cancel/await', async (req, res) => {
  const { id } = req.params;

  const PER_REQUEST_WAIT = 30_000;
  const start = Date.now();
  let order = await Order.findById(id);
  if (!order) return res.status(404).json({ ok:false, error:'ไม่พบออเดอร์' });

  const early = String(order.status||'').toLowerCase();
  if (early === 'canceled' || early === 'partial') {
    return res.json({
      ok:true, updated:true,
      status: order.status,
      refundAmount: order.refundAmount ?? 0,
      refundType: order.refundType ?? null,
      updatedAt: order.updatedAt
    });
  }

  const interval = 3_000;
  while (Date.now() - start < PER_REQUEST_WAIT) {
    await order.populate('service');
    const advanced = await forceCheckProviderAndUpdate(order);
    if (advanced) {
      return res.json({
        ok:true, updated:true,
        status: order.status,
        refundAmount: order.refundAmount ?? 0,
        refundType: order.refundType ?? null,
        updatedAt: order.updatedAt
      });
    }

    order = await Order.findById(id);
    const st = String(order?.status||'').toLowerCase();
    if (st === 'canceled' || st === 'partial') {
      return res.json({
        ok:true, updated:true,
        status: order.status,
        refundAmount: order.refundAmount ?? 0,
        refundType: order.refundType ?? null,
        updatedAt: order.updatedAt
      });
    }

    await sleep(interval);
  }

  return res.json({ ok:true, updated:false, keepWaiting:true });
});

router.get('/api/orders/:id/local-status', async (req, res) => {
  try {
    const { id } = req.params;

    const query = { _id: id };
    if (req.user?.role !== 'admin') {
      query.user = req.user._id;
    }

    const o = await Order.findOne(query)
      .select(SMM_LOCAL_STATUS_SELECT)
      .lean();

    if (!o) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const status = normalizeSmmStatusForDisplay(o);
    const snap = normalizeTerminalOrderSnapshot({
      status,
      quantity: o.quantity,
      startCount: o.startCount,
      currentCount: o.currentCount,
      remains: o.remains,
      progress: o.progress,
    });

    return res.json({
      ok: true,
      status,
      rawStatus: o.providerResponse?.lastStatus?.rawStatus || o.status || '',
      progress:      (typeof snap.progress === 'number') ? snap.progress : undefined,
      remains:       Number.isFinite(snap.remains) ? snap.remains : undefined,
      start_count:   Number.isFinite(snap.startCount) ? snap.startCount : undefined,
      current_count: Number.isFinite(snap.currentCount) ? snap.currentCount : undefined,
      updatedAt:     (o.updatedAt || o.createdAt),
      refundAmount:  (typeof o.refundAmount === 'number') ? o.refundAmount : undefined,
      refundType:    (typeof o.refundType === 'string') ? o.refundType : undefined
    });
  } catch (e) {
    glog.error('local-status error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});


// Batch local status endpoint for the SMM history page.
// Replaces many small polling requests with one small MongoDB query + one HTTP response.
router.get('/api/orders/local-status-batch', async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(x => x.trim())
      .filter(x => mongoose.isValidObjectId(x))
      .slice(0, 80);

    if (!ids.length) return res.json({ ok:true, items:[] });

    const query = { _id: { $in: ids } };
    if (req.user?.role !== 'admin') query.user = req.user._id;

    const rows = await Order.find(query)
      .select(SMM_LOCAL_STATUS_SELECT)
      .lean();

    const items = rows.map((o) => {
      const status = normalizeSmmStatusForDisplay(o);
      const snap = normalizeTerminalOrderSnapshot({
        status,
        quantity: o.quantity,
        startCount: o.startCount,
        currentCount: o.currentCount,
        remains: o.remains,
        progress: o.progress,
      });

      return {
        ok: true,
        id: String(o._id),
        status,
        rawStatus: o.providerResponse?.lastStatus?.rawStatus || o.status || '',
        progress:      (typeof snap.progress === 'number') ? snap.progress : undefined,
        remains:       Number.isFinite(snap.remains) ? snap.remains : undefined,
        start_count:   Number.isFinite(snap.startCount) ? snap.startCount : undefined,
        current_count: Number.isFinite(snap.currentCount) ? snap.currentCount : undefined,
        updatedAt:     (o.updatedAt || o.createdAt),
        refundAmount:  (typeof o.refundAmount === 'number') ? o.refundAmount : undefined,
        refundType:    (typeof o.refundType === 'string') ? o.refundType : undefined
      };
    });

    return res.json({ ok:true, items });
  } catch (e) {
    glog.error('local-status-batch error:', e);
    return res.status(500).json({ ok:false, error: 'Internal error' });
  }
});

export default router;
