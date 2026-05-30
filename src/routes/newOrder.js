import express from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { Category } from '../models/Category.js';
import { Subcategory } from '../models/Subcategory.js';
import { Service } from '../models/Service.js';
import { computePrice, computeEffectiveRateEx } from '../lib/pricing.js';
import { getRateUnit } from '../lib/rateUnit.js';
import { config } from '../config.js';
import { getRedisClient } from '../lib/redisClient.js';
// ServiceCache ย้ายจาก MongoDB → Redis แล้ว (ลด Egress)
import { Settings } from '../models/Settings.js';
import { seoMeta } from '../lib/seo.js';

const router = express.Router();

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


function setPrivateCatalogCache(res, seconds = 120) {
  const ttl = Math.max(30, Math.min(1800, Number(seconds) || 120));
  res.setHeader('Cache-Control', `private, max-age=${ttl}, stale-while-revalidate=${ttl}`);
  res.setHeader('Vary', 'Cookie');
}
function weakEtag(value) {
  return 'W/\"' + crypto.createHash('sha1').update(JSON.stringify(value || '')).digest('hex') + '\"';
}
function sendPrivateJsonWithEtag(req, res, payload, seconds = 300) {
  const ttl = Math.max(30, Math.min(1800, Number(seconds) || 300));
  const etag = weakEtag(payload);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', `private, max-age=${ttl}, stale-while-revalidate=${ttl}`);
  res.setHeader('Vary', 'Cookie');
  if (String(req.headers['if-none-match'] || '').split(',').map(v => v.trim()).includes(etag)) {
    return res.status(304).end();
  }
  return res.json(payload);
}

// ===============================
// 🚀 OPTIMIZED SERVICES API
// ===============================
const serviceCache = new Map();
const priceCache = new Map();

const CACHE_TTL = 5 * 60 * 1000; // 5 นาที
const PRICE_TTL = 5 * 60 * 1000;

// ---- price cache helpers ----
function getCachedPrice(key) {
  const v = priceCache.get(key);
  if (!v) return null;

  if (Date.now() - v.ts > PRICE_TTL) {
    priceCache.delete(key);
    return null;
  }
  return v.value;
}

function setCachedPrice(key, value) {
  priceCache.set(key, { value, ts: Date.now() });
}

/* หน้า UI */
router.get('/orders/new', async (req, res) => {
  const cats = await Category.find({}).lean().sort({ name: 1 });
  res.render('orders/new', { ...seoMeta('/orders/new'), cats });
});

/* ชั้น 1: แพลตฟอร์ม */
router.get('/api/platforms', async (req, res) => {
  setPrivateCatalogCache(res, 300);
  const cats = await Category.find({}).lean().sort({ name: 1 });
  return sendPrivateJsonWithEtag(req, res, cats, 600);
});

/* ชั้น 2: หมวด (ServiceType) ใต้แพลตฟอร์ม */
router.get('/api/subcategories', async (req, res) => {
  setPrivateCatalogCache(res, 300);
  const { cat } = req.query;
  const subs = await Subcategory.find({ category: cat }).lean().sort({ name: 1 });
  return sendPrivateJsonWithEtag(req, res, subs, 600);
});

/* ยูทิล: flatten service เดียวให้เป็น “บริการที่เลือกได้” */
function flattenOne(svc, base) {
  const rate = Number(base?.rate ?? svc.rate ?? 0);
  const currency = base?.currency || svc.currency || 'THB';
  const min = Number(base?.min ?? svc.min ?? 0);
  const max = Number(base?.max ?? svc.max ?? 0);
  const step = Number(base?.step ?? svc.step ?? 1);
  const avg = base?.average_delivery || svc.average_delivery || '';
  const refill = !!(base?.refill ?? svc.refill);
  const cancel = !!(base?.cancel ?? svc.cancel);
  const drip = !!(base?.dripfeed ?? svc.dripfeed);

  return {
    // ใช้ _id ของ document แม่ + providerServiceId ย่อย เพื่อให้ unique
    _id: svc._id?.toString?.() || base?._id?.toString?.() || undefined,
    parentId: base?._id?.toString?.() || null,
    providerServiceId: Number(base?.providerServiceId ?? svc.providerServiceId ?? base?.id ?? svc.id),
    name: base?.name || svc.name || '',
    description: base?.description || svc.description || '',
    rate, currency, min, max, step,
    average_delivery: avg,
    refill, cancel, dripfeed: drip,
    updatedAt: base?.updatedFromProviderAt || svc.updatedFromProviderAt || svc.updatedAt || base?.updatedAt || null,
    category: base?.category || svc.category,
    subcategory: base?.subcategory || svc.subcategory,
    // สำหรับคำนวณราคาโชว์ (เผื่อมี markup)
    displayRate: rate, // จะโดน computePrice ด้านล่างอีกที
    details: base?.details || svc.details || null,
  };
}

router.get('/api/service-groups', async (req, res) => {
  setPrivateCatalogCache(res, 180);
  const cat = req.query.cat;
  const key = `service-groups:${cat}`;

  // 🔥 1. ดึงจาก Redis cache ก่อน
  let cached = null;
  try {
    const raw = await getRedisClient().get(`svcache:${key}`);
    if (raw) cached = { data: JSON.parse(raw) };
  } catch {}

  if (cached) {
    return sendPrivateJsonWithEtag(req, res, cached.data, 600);
  }

  // 🔴 2. fallback → query จริง
  const groups = await Service.find({ category: cat })
    .select({ name:1, description:1, updatedAt:1, details:1 })
    .lean();

  const payload = groups.map(g => ({
    ...g,
    details: {
      ...(g.details || {}),
      services: (g.details?.services || []).map(s => ({
        ...s,
        rateUnit: getRateUnit(s.id)
      }))
    }
  }));

  // 💾 3. save ลง Redis cache (TTL 10 นาที)
  try {
    await getRedisClient().set(`svcache:${key}`, JSON.stringify(payload), 'EX', 600);
  } catch {}

  return sendPrivateJsonWithEtag(req, res, payload, 600);
});

/* ชั้น 3: บริการของหมวด — รองรับทั้ง service ตรง ๆ และ services[] ย่อย */
router.get('/api/services', async (req, res) => {
  setPrivateCatalogCache(res, 120);
  try {
    const { sub } = req.query;
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    const cacheKey = `sub:${sub}:limit:${limit}`;
    const cached = serviceCache.get(cacheKey);

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return sendPrivateJsonWithEtag(req, res, cached.data, 300);
    }

    // ===============================
    // ✅ QUERY DB
    // ===============================
    const docs = await Service.find({ subcategory: sub })
      .limit(limit)
      .lean()
      .sort({ name: 1 });

    // ===============================
    // ✅ FLATTEN
    // ===============================
    const items = [];

    for (const d of docs) {
      const children = Array.isArray(d?.details?.services)
        ? d.details.services
        : [];

      if (children.length) {
        for (const c of children) {
          items.push({ c, d });
        }
      } else {
        items.push({ c: d, d });
      }
    }

    // ===============================
    // 🚀 SAFE PARALLEL (ไม่พังทั้งก้อน)
    // ===============================
    const out = [];

    for (const { c, d } of items) {
      try {
        const item = flattenOne(c, d);

        item.rateUnit = getRateUnit(item.providerServiceId);

        const priceKey = `${item.providerServiceId}-${item.category}-${item.subcategory}-${req.user?._id}`;

        let price = getCachedPrice(priceKey);

        if (price === null) {
          try {
            // ✅ ใช้ d (Service doc จริง) เท่านั้น
            const ex = await computeEffectiveRateEx({
              service: d,
              serviceId: d?._id,
              childId: c?.id ?? null,
              userId: req.user?._id,
              baseRate: item.rate
            });

            price = Number(ex?.finalRate ?? item.rate);

          } catch (e) {
            glog.warn('[pricing fallback]', e.message);
            price = item.rate;
          }

          setCachedPrice(priceKey, price);
        }

        item.displayRate = price;

        out.push(item);

      } catch (e) {
        glog.warn('[item skip]', e.message);
        // ❌ ไม่ให้พังทั้ง list
        continue;
      }
    }

    // ===============================
    // ✅ SORT
    // ===============================
    out.sort((a, b) => {
      const n = (a.name || '').localeCompare(b.name || '');
      if (n !== 0) return n;
      return (a.displayRate || 0) - (b.displayRate || 0);
    });

    // ===============================
    // ✅ CACHE
    // ===============================
    serviceCache.set(cacheKey, {
      ts: Date.now(),
      data: out
    });

    return sendPrivateJsonWithEtag(req, res, out, 300);

  } catch (err) {
    glog.error('[services API error]', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

/* ถ้าจะดึงรายละเอียดบริการ “แบบ flatten แล้ว” ไม่ต้องยิงเพิ่ม — แต่ถ้าจะแยก route ก็ใช้ตัวนี้ */
router.get('/api/service/:providerId', async (req, res) => {
  setPrivateCatalogCache(res, 120);
  const pid = Number(req.params.providerId);
  const d = await Service.findOne({ providerServiceId: pid }).lean();
  if (!d) return res.status(404).json({ error: 'not found' });

  const children = Array.isArray(d?.details?.services) ? d.details.services : [];
  let item;
  if (children.length) {
    const c = children.find(x => Number(x.id) === pid) || children[0];
    item = flattenOne(c, d);
  } else {
    item = flattenOne(d, null);
  }
  item.displayRate = await computePrice(item.rate, {
    categoryId: item.category, subcategoryId: item.subcategory, serviceId: d._id
  });
  item.rateUnit = getRateUnit(item.providerServiceId);
  res.json(item);
});

// ===============================
// 🔑 CACHE VERSION API
// ===============================
router.get('/api/cache-version', async (req, res) => {
  try {
    const row = await Settings.findOne({ key: 'cache_version' }).lean();

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json({
      ok: true,
      version: row?.value || "v1"
    });

  } catch (e) {
    console.error('[cache-version error]', e);
    return res.json({
      ok: true,
      version: "v1"
    });
  }
});

export default router;
