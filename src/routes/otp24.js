// src/routes/otp24.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Otp24Product } from '../models/Otp24Product.js';
import { Otp24Order } from '../models/Otp24Order.js';
import { User } from '../models/User.js';
import { buyOtp, getOtpStatus, OTP24_COUNTRIES, buyOtpAgain, canReuse } from '../lib/otp24Adapter.js';
import { refreshOtp24BalanceAsync } from '../lib/otp24BalanceUtil.js';
import { reconcileOtp24OrderSpend, recalcUserTotals } from '../services/spend.js';
import { config } from '../config.js';
import { seoMeta } from '../lib/seo.js';

const router = Router();

// แยกประวัติ OTP เช่าเบอร์ออกจากระบบแอคเคาท์/แอพ getpack
// ถ้ามีข้อมูล pack เก่าหลงอยู่ใน otp24orders จะไม่ถูกแสดงในหน้า OTP24 อีก
const OTP_ONLY_ORDER_FILTER = {
  $or: [
    { productKind: { $exists: false } },
    { productKind: 'otp' },
    { productKind: null },
  ],
};

// หน้า /otp24 ต้องแสดงเฉพาะสินค้า OTP เท่านั้น
// สินค้าแพ็ก/แอพ (productKind: 'pack') ให้ไปอยู่ใน /apps อย่างเดียว
const OTP_ONLY_PRODUCT_FILTER = { provider: 'otp24', productKind: 'otp' };

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

const ACTIVE_STATUSES = ['processing','pending','waiting','purchased'];
function round2(n){ return Math.round((Number(n)||0)*100)/100; }

const OTP24_TTL_MS = Number(config?.otp?.ttlSec || 600) * 1000;


function displayPhoneByCountry(rawPhone, countryId) {
  const raw = String(rawPhone || '').trim();
  if (!raw) return '';

  const cid = Number(countryId || 0);

  // Thailand / OTP24 countryId 52: provider usually returns 66xxxxxxxxx.
  // UI must show local format 0xxxxxxxxx while keeping DB/provider value unchanged.
  if (cid === 52) {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('66') && digits.length >= 11) return `0${digits.slice(2)}`;
    if (digits.startsWith('0')) return digits;
  }

  return raw;
}

function getOtp24ExpiresAt(order) {
  if (order?.expiresAt) return new Date(order.expiresAt);

  const base =
    order?.createdAt ||
    order?.created_at ||
    order?.updatedAt ||
    new Date();

  return new Date(new Date(base).getTime() + OTP24_TTL_MS);
}

function isOtp24Expired(order) {
  return getOtp24ExpiresAt(order).getTime() <= Date.now();
}

function normalizeOtp24Status(status) {
  const s = String(status || '').trim().toLowerCase();

  if (
    s.includes('refund') ||
    s.includes('refunded')
  ) return 'refunded';

  if (
    s.includes('timeout') ||
    s.includes('expired') ||
    s === 'expire'
  ) return 'timeout';

  if (
    s.includes('fail') ||
    s.includes('error') ||
    s.includes('cancel') ||
    s === 'reject'
  ) return 'failed';

  if (
    s.includes('success') ||
    s.includes('complete') ||
    s.includes('done') ||
    s === 'ok'
  ) return 'success';

  return 'processing';
}

function isOtp24EndStatus(status) {
  return ['success', 'refunded', 'timeout', 'failed', 'canceled'].includes(
    String(status || '').toLowerCase()
  );
}

async function refundOtp24OrderOnce(
  order,
  reason = 'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
) {
  if (!order?._id) return order;

  // ✅ HARD GUARD: ห้าม refund ก่อนครบ 10 นาทีจาก createdAt/expiresAt
  if (!isOtp24Expired(order)) {
    glog.warn('[otp24/refund] blocked: not expired yet', {
      orderId: order.orderId,
      createdAt: order.createdAt,
      expiresAt: getOtp24ExpiresAt(order),
      now: new Date(),
    });

    return Otp24Order.findById(order._id);
  }

  const sale = round2(Number(order.salePrice || 0));
  const now = new Date();

  const cutoffCreatedAt = new Date(Date.now() - OTP24_TTL_MS);

  const updated = await Otp24Order.updateOne(
    {
      _id: order._id,
      refundApplied: { $ne: true },
      status: { $nin: ['canceled'] },

      // ✅ กัน DB-level อีกชั้น: ต้องครบเวลาแล้วเท่านั้น
      $and: [
        {
          $or: [
            { expiresAt: { $lte: now } },
            {
              expiresAt: { $exists: false },
              createdAt: { $lte: cutoffCreatedAt },
            },
            {
              expiresAt: null,
              createdAt: { $lte: cutoffCreatedAt },
            },
          ],
        },
        {
          // ✅ ห้าม refund ถ้ามี OTP จริง
          $or: [
            { otp: { $exists: false } },
            { otp: null },
            { otp: '' },
            { otp: '0' },
            { otp: 0 },
            { otp: '-' },
            { otp: 'ไม่พบข้อความ' },
            { otp: 'ไม่พบข้อความ OTP ของคุณ' },
            { otp: /^ไม่พบ/i },
            { otp: /^ไม่มี/i },
            { otp: /no otp/i },
            { otp: /not found/i },
            { otp: /not received/i },
          ],
        },
      ],
    },
    {
      $set: {
        status: 'refunded',
        message: reason,
        refundApplied: true,
        refundAmount: sale,
        refundedAt: now,
        refundNote: reason,
        otpSpentAccounted: 0,
      },
    }
  );

  if (updated.modifiedCount === 1 && sale > 0 && order.user) {
    await User.updateOne(
      { _id: order.user },
      {
        $inc: {
          balance: sale,
        },
      }
    );

    try {
      await recalcUserTotals(order.user, {
        force: true,
        reason: 'otp24_refund',
      });
    } catch (e) {
      glog.error('[otp24/refund] recalc failed:', e?.message || e);
    }
  }

  return Otp24Order.findById(order._id);
}

function hasOtpValue(v) {
  const s = String(v ?? '').trim();

  if (!s) return false;

  const badValues = new Set([
    '0',
    '-',
    'null',
    'undefined',
    'false',
    'none',
    'no otp',
    'ไม่พบข้อความ',
    'ไม่พบข้อความ otp',
    'ไม่พบข้อความ otp ของคุณ',
    'ไม่พบข้อความ OTP ของคุณ'.toLowerCase(),
  ]);

  return !badValues.has(s.toLowerCase());
}

function normalizeOrderForView(order) {
  const o = { ...order };
  const st = String(o.status || '').toLowerCase();

  // กันเคส provider/ข้อมูลเก่า mark success มาแล้ว แต่ยังไม่มี OTP
  // หน้าเว็บต้องถือว่ายังรออยู่ เพื่อให้ auto-refresh ยิง /refresh แล้วค่อย refund เมื่อครบเวลา
  if (st === 'success' && !hasOtpValue(o.otp)) {
    o.status = 'processing';
    o.message = o.message || 'ระบบกำลังรอ OTP…';
  }

  if (!o.expiresAt) {
    o.expiresAt = getOtp24ExpiresAt(o);
  }

  // ใช้สำหรับแสดงผลหน้าเว็บเท่านั้น ไม่แก้ค่าจริงใน DB/provider
  o.displayPhone = displayPhoneByCountry(o.phone, o.countryId);

  return o;
}

// GET /otp24 — หน้าแสดงบริการ + ประวัติในหน้าเดียว
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = { ...OTP_ONLY_PRODUCT_FILTER };

  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name:  { $regex: safe, $options: 'i' } },
      { code:  { $regex: safe, $options: 'i' } },
    ];
  }

  // ───────────────────────────────
  // โหลด products ทั้งหมด
  // ───────────────────────────────
  const items = await Otp24Product.find(filter, { _id:1, name:1, raw:1, extId:1, code:1, basePrice:1, price:1, providerPrice:1 }).lean();

  // ───────────────────────────────
  // นับยอดขายรวมทั้งหมดแบบ All-time จาก collection otp24orders
  // ใช้ทุกสถานะที่เคยสร้างคำสั่งซื้อ เพื่อให้การจัดอันดับ "ซื้อบ่อยสุด"
  // ไม่รีเซ็ตตามการ sync และไม่ผูกกับ user ปัจจุบัน
  // ───────────────────────────────
  // Cost guard: aggregate counters in MongoDB instead of reading every order document.
  // This keeps the public OTP page fast and sharply reduces MongoDB egress when history grows.
  const soldOrders = await Otp24Order.aggregate([
    { $match: OTP_ONLY_ORDER_FILTER },
    {
      $project: {
        productId: 1,
        serviceCode: 1,
        typeCode: 1,
        code: 1,
        productName: 1,
        appName: 1,
        name: 1,
        qtyN: { $convert: { input: { $ifNull: ['$quantity', { $ifNull: ['$qty', 1] }] }, to: 'int', onError: 1, onNull: 1 } },
      },
    },
    {
      $group: {
        _id: {
          productId: '$productId',
          serviceCode: '$serviceCode',
          typeCode: '$typeCode',
          code: '$code',
          productName: '$productName',
          appName: '$appName',
          name: '$name',
        },
        n: { $sum: { $cond: [{ $gt: ['$qtyN', 1] }, '$qtyN', 1] } },
      },
    },
    {
      $project: {
        _id: 0,
        productId: '$_id.productId',
        serviceCode: '$_id.serviceCode',
        typeCode: '$_id.typeCode',
        code: '$_id.code',
        productName: '$_id.productName',
        appName: '$_id.appName',
        name: '$_id.name',
        quantity: '$n',
      },
    },
  ]);

  const normKey = (v) => String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/&lt;\s*br\s*\/?\s*&gt;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");

  const inc = (map, key, by = 1) => {
    const k = normKey(key);
    if (!k) return;
    map.set(k, (map.get(k) || 0) + by);
  };

  const countById = new Map();
  const countByCode = new Map();
  const countByName = new Map();

  for (const o of soldOrders) {
    const n = Math.max(1, Number(o.quantity || o.qty || 1) || 1);
    inc(countById, o.productId, n);
    inc(countByCode, o.serviceCode, n);
    inc(countByCode, o.typeCode, n);
    inc(countByCode, o.code, n);
    inc(countByName, o.productName, n);
    inc(countByName, o.appName, n);
    inc(countByName, o.name, n);
  }

  const getOrderCount = (p) => {
    const ids = [p._id, p.productId, p.raw?._id];
    const codes = [p.serviceCode, p.typeCode, p.code, p.extId, p.raw?.serviceCode, p.raw?.typeCode, p.raw?.code, p.raw?.type, p.raw?.id];
    const names = [p.name, p.productName, p.appName, p.raw?.name, p.raw?.title];
    let best = 0;
    for (const id of ids) best = Math.max(best, countById.get(normKey(id)) || 0);
    for (const code of codes) best = Math.max(best, countByCode.get(normKey(code)) || 0);
    for (const name of names) best = Math.max(best, countByName.get(normKey(name)) || 0);
    return best;
  };

  // ───────────────────────────────
  // สร้าง products พร้อม freq จากยอดขายรวม all-time และเรียงจากสินค้าที่ถูกซื้อบ่อยสุดก่อน
  // ───────────────────────────────
  let products = items.map(p => {
    const freq = getOrderCount(p);

    return {
      _id:    String(p._id),
      name:   p.name,
      icon:   p.raw?.img || null,
      code:   p.raw?.type || p.extId || p.code,
      base:   Number(p.basePrice || p.price || 0),
      price:  Math.round((Number(p.basePrice || p.price || 0) * 1.5) * 100) / 100,
      freq,
    };
  });

  products.sort((a, b) => {
    if (b.freq !== a.freq) return b.freq - a.freq;
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  });

  // ───────────────────────────────
  // โหลด orders (ประวัติ)
  // ───────────────────────────────
  const rawOrders = req.user?._id
    ? await Otp24Order.find({ user: req.user._id, ...OTP_ONLY_ORDER_FILTER })
        .select('_id provider productKind user productId appName serviceCode countryId orderId phone providerPrice salePrice status otp message createdAt expiresAt refundApplied refundAmount refundNote updatedAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    : [];

  const orders = rawOrders.map(normalizeOrderForView);

  // ───────────────────────────────
  // ส่งเข้าสู่หน้า view
  // ───────────────────────────────
  res.render('otp24/index', {
    ...seoMeta('/otp24'),
    products,
    countries: OTP24_COUNTRIES,
    q,
    orders,
  });
});

// POST /otp24/buy — ซื้อทันที
router.post('/buy', requireAuth, async (req, res) => {
  let localOrder = null;
  let debited = false;
  let salePrice = 0;
  const userId = req.user?._id;

  try {
    const { productId, countryId } = req.body || {};
    if (!productId || !countryId) {
      return res.status(400).json({ ok: false, error: 'ข้อมูลไม่ครบ' });
    }
    if (!userId) return res.status(401).json({ ok: false, error: 'ต้องเข้าสู่ระบบ' });

    const prod = await Otp24Product.findById(productId).lean();
    if (!prod) return res.status(404).json({ ok: false, error: 'ไม่พบบริการ' });

    const serviceCode = prod?.raw?.type || prod?.extId || prod?.code;
    if (!serviceCode) {
      return res.status(400).json({ ok: false, error: 'บริการนี้ยังไม่มีรหัส type' });
    }

    const providerPrice = Number(prod.basePrice || prod.price || 0);
    salePrice = round2(providerPrice * 1.5);

    const debit = await User.updateOne(
      { _id: userId, balance: { $gte: salePrice } },
      { $inc: { balance: -salePrice } }
    );
    if (!debit?.modifiedCount) {
      return res.status(400).json({ ok: false, error: 'ยอดเงินไม่พอ' });
    }
    debited = true;

    const createdAt = new Date();
    localOrder = await Otp24Order.create({
      user: userId,
      productId: prod._id,
      appName: prod.name,
      serviceCode,
      countryId: Number(countryId),
      providerPrice,
      salePrice,
      status: 'processing',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + OTP24_TTL_MS),
      message: 'ระบบกำลังรอ OTP…',
      otpSpentAccounted: 0,
    });

    let r;
    try {
      r = await buyOtp({ type: serviceCode, ct: Number(countryId) });
    } catch (err) {
      r = { ok:false, error: err?.message || 'provider error', raw: err?.response?.data || null };
    }

    if (!r?.ok) {
      await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
      debited = false;
      await Otp24Order.updateOne(
        { _id: localOrder._id },
        { $set: { status:'failed', message:r?.error || 'ซื้อไม่สำเร็จ', providerRaw:r?.raw ?? r } }
      ).catch(() => null);

      const raw = r?.rawText || r?.raw || '';
      const looksLikeHtml = typeof raw === 'string' && raw.trim().startsWith('<');
      return res.status(502).json({
        ok: false,
        error: looksLikeHtml ? 'เบอร์หมด หรือไม่พร้อมใช้งาน' : (r?.error || 'ซื้อไม่สำเร็จ'),
      });
    }

    const providerOrderId = r.orderId || r.order_id || r.id || null;
    const providerPhone = r.phone || r.number || null;
    if (!providerOrderId) {
      await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
      debited = false;
      await Otp24Order.updateOne(
        { _id: localOrder._id },
        { $set: { status:'failed', message:'provider missing order_id', providerRaw:r } }
      ).catch(() => null);
      return res.status(502).json({ ok: false, error: 'เบอร์หมด หรือไม่พร้อมใช้งาน' });
    }

    const ord = await Otp24Order.findByIdAndUpdate(
      localOrder._id,
      {
        $set: {
          orderId: String(providerOrderId),
          phone: providerPhone,
          status: 'processing',
          message: 'ระบบกำลังรอ OTP…',
          providerRaw: r.raw ?? r,
        }
      },
      { new:true }
    );

    refreshOtp24BalanceAsync();
    return res.json({ ok: true, orderId: ord.orderId, redirect: '/otp24?tab=orders' });
  } catch (e) {
    if (debited && userId && salePrice > 0) {
      await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
    }
    if (localOrder?._id) {
      await Otp24Order.updateOne(
        { _id: localOrder._id, orderId: { $exists:false } },
        { $set: { status:'failed', message:e?.message || 'internal error' } }
      ).catch(() => null);
    }
    glog.error('[OTP24 BUY] unexpected error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'internal error' });
  }
});

router.post('/buy-again', requireAuth, async (req, res) => {
  let localOrder = null;
  let debited = false;
  let salePrice = 0;
  const userId = req.user?._id;

  try {
    const { orderId, preview } = req.body || {};
    if (!orderId) return res.status(400).json({ ok:false, error:'ข้อมูลไม่ครบ' });
    if (!userId) return res.status(401).json({ ok:false, error:'ต้องเข้าสู่ระบบ' });

    const old = await Otp24Order.findOne({ orderId, user:userId, ...OTP_ONLY_ORDER_FILTER }).lean();
    if (!old) return res.status(404).json({ ok:false, code:'NOT_FOUND', error:'ไม่พบคำสั่งซื้อเดิม' });
    if (String(old.status).toLowerCase() !== 'success') {
      return res.status(400).json({ ok:false, code:'NOT_SUCCESS', error:'ซื้อเบอร์เดิมได้เฉพาะออเดอร์ที่สำเร็จเท่านั้น' });
    }

    const activeExists = await Otp24Order.exists({ user: userId, phone: old.phone, status: { $in: ACTIVE_STATUSES } });
    if (activeExists) {
      return res.status(409).json({ ok:false, code:'ACTIVE_ORDER', active:true, error:'เบอร์ของคุณยังอยู่ในสถานะกำลังทำงานอยู่' });
    }

    let reusable = true;
    if (typeof canReuse === 'function') {
      try { reusable = await canReuse({ orderId }); } catch { reusable = null; }
    }
    if (reusable === false) {
      return res.status(410).json({ ok:false, code:'REMOVED', error:'เบอร์นี้ถูกนำออกจากระบบไปแล้ว' });
    }

    const providerPrice = Number(old.providerPrice || 0);
    salePrice = round2(providerPrice * 2.7);

    if (preview) {
      return res.json({ ok:true, preview: { appName:old.appName, phone:old.phone, countryId:old.countryId, price:salePrice } });
    }

    const debit = await User.updateOne(
      { _id: userId, balance: { $gte: salePrice } },
      { $inc: { balance: -salePrice } }
    );
    if (!debit?.modifiedCount) return res.status(400).json({ ok:false, code:'NO_MONEY', error:'ยอดเงินไม่พอ' });
    debited = true;

    const createdAt = new Date();
    localOrder = await Otp24Order.create({
      user: userId,
      productId: old.productId,
      appName: old.appName,
      serviceCode: old.serviceCode,
      countryId: old.countryId,
      providerPrice,
      salePrice,
      phone: old.phone,
      status:'processing',
      createdAt,
      expiresAt: new Date(createdAt.getTime() + OTP24_TTL_MS),
      message:'ระบบกำลังรอ OTP… (เบอร์เดิม)',
      otpSpentAccounted:0,
    });

    let r;
    try { r = await buyOtpAgain({ orderId }); }
    catch (e) { r = { ok:false, status:'error', msg:e?.message || 'provider error', raw:e?.response?.data || null }; }

    const statusStr = String(r?.status || '').toLowerCase();
    const successProvider = r?.ok && statusStr === 'success';

    if (!successProvider) {
      await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
      debited = false;
      const providerMsg = (r && (r.msg || r.message)) || '';
      const removedLike = /not\s*available|removed|cannot\s*reuse|not\s*reusable|invalid/i.test(providerMsg);
      await Otp24Order.updateOne(
        { _id: localOrder._id },
        { $set: { status:'failed', message:providerMsg || 'สั่งซื้อไม่สำเร็จ', providerRaw:r } }
      ).catch(() => null);
      return res.status(removedLike ? 410 : 502).json({
        ok:false,
        code: removedLike ? 'REMOVED' : 'PROVIDER_ERROR',
        error: removedLike ? 'เบอร์นี้ถูกนำออกจากระบบไปแล้ว' : (providerMsg || 'สั่งซื้อไม่สำเร็จ'),
        raw:r
      });
    }

    const providerOrderId = r.order_id || r.id;
    if (!providerOrderId) {
      await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
      debited = false;
      await Otp24Order.updateOne({ _id: localOrder._id }, { $set:{ status:'failed', message:'provider missing order_id', providerRaw:r } }).catch(() => null);
      return res.status(502).json({ ok:false, error:'สั่งซื้อไม่สำเร็จ' });
    }

    const ord = await Otp24Order.findByIdAndUpdate(
      localOrder._id,
      { $set: { orderId:String(providerOrderId), phone:r.number || old.phone, status:'processing', providerRaw:r.raw ?? r } },
      { new:true }
    );

    try { refreshOtp24BalanceAsync?.(); } catch {}
    return res.json({ ok:true, orderId: ord.orderId, redirect:'/otp24?tab=orders' });
  } catch (e) {
    if (debited && userId && salePrice > 0) await User.updateOne({ _id:userId }, { $inc:{ balance:salePrice } }).catch(() => null);
    if (localOrder?._id) await Otp24Order.updateOne({ _id:localOrder._id, orderId:{ $exists:false } }, { $set:{ status:'failed', message:e?.message || 'internal error' } }).catch(() => null);
    glog.error('[OTP24 BUY-AGAIN] unexpected error:', e);
    return res.status(500).json({ ok:false, error: e?.message || 'internal error' });
  }
});

// ─────────────────────────────────────────────────────────────
// (แถม) GET /otp24/buy-again/preview?orderId=...
// ใช้ลอจิกเดียวกับ POST แต่เป็นการเช็คอย่างเดียว
// ─────────────────────────────────────────────────────────────
router.get('/buy-again/preview', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.query || {};
    if (!orderId) return res.status(400).json({ ok:false, error:'ข้อมูลไม่ครบ' });

    const old = await Otp24Order.findOne({ orderId, user:req.user?._id, ...OTP_ONLY_ORDER_FILTER }).lean();
    if (!old) return res.status(404).json({ ok:false, code:'NOT_FOUND', error:'ไม่พบคำสั่งซื้อเดิม' });
    if (String(old.status).toLowerCase() !== 'success') {
      return res.status(400).json({ ok:false, code:'NOT_SUCCESS', error:'ซื้อเบอร์เดิมได้เฉพาะออเดอร์ที่สำเร็จเท่านั้น' });
    }

    const activeExists = await Otp24Order.exists({
      user: req.user._id,
      phone: old.phone,
      status: { $in: ACTIVE_STATUSES }
    });
    if (activeExists) {
      return res.status(409).json({
        ok:false,
        code:'ACTIVE_ORDER',
        active:true,
        error:'เบอร์ของคุณยังอยู่ในสถานะกำลังทำงานอยู่'
      });
    }

    let reusable = true;
    if (typeof canReuse === 'function') {
      try { reusable = await canReuse({ orderId }); } catch { reusable = null; }
    }
    if (reusable === false) {
      return res.status(410).json({ ok:false, code:'REMOVED', error:'เบอร์นี้ถูกนำออกจากระบบไปแล้ว' });
    }

    const providerPrice = Number(old.providerPrice || 0);
    const salePrice = round2(providerPrice * 2.7);

    return res.json({
      ok:true,
      preview:{
        appName:   old.appName,
        phone:     old.phone,
        countryId: old.countryId,
        price:     salePrice
      }
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:e?.message || 'internal error' });
  }
});

// รีเฟรชสถานะ + คืนเครดิตอัตโนมัติเมื่อครบเวลาแล้วยังไม่ได้ OTP
router.post('/orders/:orderId/refresh', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;

    let ord = await Otp24Order.findOne({
      orderId,
      user: req.user?._id,
    });

    if (!ord) {
      return res.status(404).json({
        ok: false,
        error: 'ไม่พบคำสั่งซื้อ',
      });
    }

    const getStatus = (v) => String(v || '').trim().toLowerCase();
    const getText = (v) => String(v ?? '').trim();

    const hasOrderOtp = (order) => hasOtpValue(order?.otp);

    const isProviderEndedWithoutOtp = (rawStatus) => {
      const s = getStatus(rawStatus);

      return (
        s.includes('refund') ||
        s.includes('refunded') ||
        s.includes('timeout') ||
        s.includes('expired') ||
        s.includes('expire') ||
        s.includes('fail') ||
        s.includes('error') ||
        s.includes('cancel') ||
        s === 'reject' ||
        s === 'rejected'
      );
    };

    const isProviderSuccess = (rawStatus) => {
      const s = getStatus(rawStatus);

      return (
        s.includes('success') ||
        s.includes('complete') ||
        s.includes('completed') ||
        s.includes('done') ||
        s === 'ok'
      );
    };

    const setProcessingSafe = async (order, message, extra = {}) => {
      if (!order?._id) return order;

      // ✅ ถ้ามี OTP จริง ห้ามย้อนกลับ processing
      if (hasOrderOtp(order)) return order;

      // ✅ ถ้า refund ไปแล้ว ห้ามแก้กลับ
      if (order.refundApplied === true) return order;

      await Otp24Order.updateOne(
        {
          _id: order._id,
          refundApplied: { $ne: true },
          status: { $nin: ['canceled', 'success'] },
        },
        {
          $set: {
            status: 'processing',
            message: message || 'ระบบกำลังรอ OTP…',
            checkedAt: new Date(),
            ...extra,
          },
        }
      );

      return Otp24Order.findById(order._id);
    };

    /**
     * =========================================================
     * ✅ กฎใหม่:
     * ไม่ว่า success/refunded/failed/no otp จาก provider หรือ DB
     * ถ้ายังไม่ครบ 10 นาทีจาก createdAt/expiresAt = ห้าม refund
     * =========================================================
     */
    const expiredNow = isOtp24Expired(ord);

    if (!hasOrderOtp(ord)) {
      const st = getStatus(ord.status);

      // success ปลอม / refunded แต่ยังไม่ครบเวลา
      if (
        !expiredNow &&
        (
          st === 'success' ||
          st === 'refunded' ||
          st === 'timeout' ||
          st === 'failed' ||
          st === 'fail'
        ) &&
        ord.refundApplied !== true
      ) {
        ord = await setProcessingSafe(
          ord,
          ord.message || 'ระบบกำลังรอ OTP…'
        );
      }

      // ถ้าครบเวลาแล้ว และยังไม่มี OTP ถึงจะ refund
      if (
        isOtp24Expired(ord) &&
        ord.refundApplied !== true &&
        (
          ['processing', 'success', 'refunded', 'timeout', 'failed', 'fail'].includes(getStatus(ord.status))
        )
      ) {
        ord = await refundOtp24OrderOnce(
          ord,
          ord.message || 'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
        );
      }
    }

    ord = await Otp24Order.findById(ord._id);

    if (!ord) {
      return res.status(404).json({
        ok: false,
        error: 'ไม่พบคำสั่งซื้อหลังอัปเดต',
      });
    }

    /**
     * เรียก provider เฉพาะรายการที่ยังไม่จบจริง
     */
    const statusBeforeProvider = getStatus(ord.status);

    const canCheckProvider =
      !hasOrderOtp(ord) &&
      ord.refundApplied !== true &&
      !['canceled'].includes(statusBeforeProvider);

    if (canCheckProvider) {
      const r = await getOtpStatus(orderId).catch((err) => {
        glog.error('[otp24/refresh] provider failed:', err?.message || err);
        return null;
      });

      if (r?.ok) {
        const providerOtp = getText(r.otp);
        const providerRawStatus = getText(r.status);
        const providerMsg = getText(r.msg || r.message);

        /**
         * ✅ มี OTP จริง = success ทันที
         */
        if (hasOtpValue(providerOtp)) {
          const beforeStatus = getStatus(ord.status);

          ord.otp = providerOtp;
          ord.status = 'success';
          ord.message = providerMsg || 'ได้รับ OTP แล้ว';
          ord.completedAt = new Date();

          if (r.phone && !ord.phone) {
            ord.phone = String(r.phone);
          }

          await ord.save();

          if (beforeStatus !== 'success') {
            try {
              await reconcileOtp24OrderSpend(ord._id);
              await recalcUserTotals(ord.user, {
                force: true,
                reason: 'otp24_refresh_success',
              });
            } catch (e) {
              glog.error(
                '[otp24/refresh] reconcile/recalc failed:',
                e?.message || e
              );
            }
          }
        }

        /**
         * ❌ Provider บอกจบแล้ว แต่ไม่มี OTP
         * ยังไม่ครบ 10 นาที = processing
         * ครบ 10 นาทีแล้ว = refund
         */
        else if (
          isProviderEndedWithoutOtp(providerRawStatus) ||
          isProviderSuccess(providerRawStatus)
        ) {
          if (isOtp24Expired(ord)) {
            ord = await refundOtp24OrderOnce(
              ord,
              providerMsg ||
                'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
            );
          } else {
            ord = await setProcessingSafe(
              ord,
              providerMsg || 'ระบบกำลังรอ OTP…',
              {
                providerLastStatus: providerRawStatus || null,
                providerLastMessage: providerMsg || null,
              }
            );
          }
        }

        /**
         * Provider ยังไม่จบ
         */
        else {
          if (isOtp24Expired(ord)) {
            ord = await refundOtp24OrderOnce(
              ord,
              'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
            );
          } else {
            ord = await setProcessingSafe(
              ord,
              providerMsg || 'ระบบกำลังรอ OTP…',
              {
                providerLastStatus: providerRawStatus || null,
                providerLastMessage: providerMsg || null,
              }
            );
          }
        }
      }

      /**
       * Provider ตอบไม่ได้
       * ครบ 10 นาทีแล้วเท่านั้นถึง refund
       */
      else if (isOtp24Expired(ord) && !hasOrderOtp(ord)) {
        ord = await refundOtp24OrderOnce(
          ord,
          'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
        );
      }
    }

    /**
     * FINAL GUARD:
     * กันทุกเคสก่อนส่งกลับ frontend
     */
    ord = await Otp24Order.findById(ord._id);

    if (!ord) {
      return res.status(404).json({
        ok: false,
        error: 'ไม่พบคำสั่งซื้อหลังอัปเดต',
      });
    }

    // ✅ ถ้ามี OTP จริง แต่ status ยังไม่ success ให้แก้เป็น success
    if (hasOrderOtp(ord) && getStatus(ord.status) !== 'success') {
      ord.status = 'success';
      ord.message = ord.message || 'ได้รับ OTP แล้ว';
      ord.completedAt = ord.completedAt || new Date();
      await ord.save();
    }

    // ✅ ไม่มี OTP + ครบ 10 นาทีแล้วเท่านั้น ถึง refund
    if (
      !hasOrderOtp(ord) &&
      ord.refundApplied !== true &&
      isOtp24Expired(ord) &&
      ['processing', 'success', 'refunded', 'timeout', 'failed', 'fail'].includes(getStatus(ord.status))
    ) {
      ord = await refundOtp24OrderOnce(
        ord,
        ord.message || 'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
      );
    }

    ord = await Otp24Order.findById(ord._id);

    if (!ord) {
      return res.status(404).json({
        ok: false,
        error: 'ไม่พบคำสั่งซื้อหลังอัปเดต',
      });
    }

    return res.json({
      ok: true,
      patch: {
        orderId: ord.orderId,
        status: ord.status,
        otp: hasOtpValue(ord.otp) ? ord.otp : '',
        phone: ord.phone || '',
        displayPhone: displayPhoneByCountry(ord.phone, ord.countryId),
        message: ord.message || '',
        expiresAt: getOtp24ExpiresAt(ord).toISOString(),
        refundApplied: !!ord.refundApplied,
        // ถ้าเป็น order เก่าที่ยังไม่มี refundAmount ให้ fallback เป็น salePrice
        refundAmount: Number(
          ord.refundAmount ||
          (ord.refundApplied ? ord.salePrice : 0) ||
          0
        ),
        refundedAt: ord.refundedAt || null,
        otpSpentAccounted: Number(ord.otpSpentAccounted || 0),
        salePrice: Number(ord.salePrice || 0),
      },
    });
  } catch (e) {
    glog.error('[otp24/refresh] failed:', e);

    return res.status(500).json({
      ok: false,
      error: e?.message || 'internal error',
    });
  }
});

export default router;
