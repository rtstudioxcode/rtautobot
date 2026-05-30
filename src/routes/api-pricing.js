// routes/api-pricing.js  (ESM)
import express from 'express';
import { Service } from '../models/Service.js';
import { computeEffectiveRate } from '../lib/pricing.js';
import { config } from '../config.js';

const router = express.Router();

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => config?.system?.globalLogEnabled === true;
const glog = {
  log: (...args) => { if (isGlobalLogEnabled()) console.log(...args); },
  info: (...args) => { if (isGlobalLogEnabled()) console.info(...args); },
  warn: (...args) => { if (isGlobalLogEnabled()) console.warn(...args); },
  error: (...args) => { if (isGlobalLogEnabled()) console.error(...args); },
};

// Effective rate can depend on the logged-in user / price rules, so keep it private.
// This cache reduces repeated Railway/DB work while avoiding cross-user price leaks.
const RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_CACHE_MAX = 25_000;
const rateCache = new Map(); // key -> { t, value }

function currentUserId(req) {
  const me = req.user || req.session?.user || null;
  return me?._id ? String(me._id) : 'guest';
}
function cacheKeyForRate({ userId, serviceId, childId }) {
  return `${userId || 'guest'}:${String(serviceId || '')}:${String(childId || '')}`;
}
function getRateCache(key) {
  const row = rateCache.get(key);
  if (!row) return null;
  if (Date.now() - row.t > RATE_CACHE_TTL_MS) { rateCache.delete(key); return null; }
  return row.value;
}
function setRateCache(key, value) {
  if (rateCache.size > RATE_CACHE_MAX) {
    const first = rateCache.keys().next().value;
    if (first) rateCache.delete(first);
  }
  rateCache.set(key, { t: Date.now(), value });
}
function setPrivateRateCacheHeaders(res) {
  res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=300');
  res.setHeader('Vary', 'Cookie');
}
function calcCost(qty, rate, unit = 1000) {
  const q = Number(qty || 0);
  const r = Number(rate || 0);
  const u = Math.max(1, Number(unit || 1000));
  if (!q) return undefined;
  return Math.max(0, Math.round(((q / u) * r) * 100) / 100);
}
function getChildService(service, childId) {
  if (childId != null && Array.isArray(service?.details?.services)) {
    return service.details.services.find(x => String(x?.id) === String(childId)) || null;
  }
  return null;
}
async function buildRatePayload({ service, childId, userId }) {
  const child = getChildService(service, childId);
  if (childId != null && !child) return null;
  const baseRate = Number(child?.rate ?? service?.rate ?? 0);
  const currency = child?.currency || service?.currency || 'THB';
  const unit = 1000;
  const eff = await computeEffectiveRate({
    service,
    childId: childId ?? null,
    userId: userId === 'guest' ? null : userId,
    baseRate
  });
  const rate = Number(eff);
  return {
    rate,
    baseRate: Number(baseRate),
    currency,
    unit,
    source: Number.isFinite(rate) && rate !== Number(baseRate) ? 'effective' : 'base'
  };
}

router.get('/pricing/effective-rate', async (req, res) => {
  try {
    const serviceId = String(req.query.serviceId || '').trim();
    const childId = req.query.childId != null ? String(req.query.childId).trim() : null;
    const qtyRaw = req.query.qty;
    const qty = Number.isFinite(Number(qtyRaw)) ? Number(qtyRaw) : null;
    if (!serviceId) return res.status(400).json({ ok: false, error: 'missing serviceId' });

    const userId = currentUserId(req);
    const key = cacheKeyForRate({ userId, serviceId, childId });
    let payload = getRateCache(key);
    if (!payload) {
      const service = await Service.findById(serviceId).lean();
      if (!service) return res.status(404).json({ ok: false, error: 'service not found' });
      payload = await buildRatePayload({ service, childId, userId });
      if (!payload) return res.status(404).json({ ok: false, error: 'child service not found' });
      setRateCache(key, payload);
    }

    const cost = qty != null ? calcCost(qty, payload.rate, payload.unit) : undefined;
    setPrivateRateCacheHeaders(res);
    return res.json({
      ok: true,
      serviceId,
      childId: childId || null,
      rate: payload.rate,
      baseRate: payload.baseRate,
      currency: payload.currency,
      ...(cost !== undefined ? { cost } : {}),
      source: payload.source,
      cached: true
    });
  } catch (err) {
    glog.error('GET /api/pricing/effective-rate error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

// ===============================
// ⚡ BATCH EFFECTIVE RATE
// ===============================
router.post('/pricing/effective-rate/batch', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, error: 'missing items' });

    const userId = currentUserId(req);
    const normalized = items
      .map(i => ({
        serviceId: String(i.serviceId || '').trim(),
        childId: i.childId != null ? String(i.childId).trim() : null,
        qty: Number(i.qty || 0)
      }))
      .filter(i => i.serviceId);

    const results = {};
    const missing = [];

    for (const item of normalized) {
      const cacheKey = cacheKeyForRate({ userId, serviceId: item.serviceId, childId: item.childId });
      const hit = getRateCache(cacheKey);
      if (hit) {
        const responseKey = `${item.serviceId}:${item.childId}:${item.qty}`;
        results[responseKey] = {
          ...hit,
          ...(item.qty ? { cost: calcCost(item.qty, hit.rate, hit.unit) } : {})
        };
      } else {
        missing.push(item);
      }
    }

    if (missing.length) {
      const serviceIds = [...new Set(missing.map(i => i.serviceId))];
      const services = await Service.find({ _id: { $in: serviceIds } }).lean();
      const serviceMap = new Map(services.map(s => [String(s._id), s]));

      for (const item of missing) {
        try {
          const service = serviceMap.get(item.serviceId);
          if (!service) continue;
          const payload = await buildRatePayload({ service, childId: item.childId, userId });
          if (!payload) continue;
          const cacheKey = cacheKeyForRate({ userId, serviceId: item.serviceId, childId: item.childId });
          setRateCache(cacheKey, payload);
          const responseKey = `${item.serviceId}:${item.childId}:${item.qty}`;
          results[responseKey] = {
            ...payload,
            ...(item.qty ? { cost: calcCost(item.qty, payload.rate, payload.unit) } : {})
          };
        } catch (e) {
          glog.warn('batch item error:', e?.message || e);
        }
      }
    }

    setPrivateRateCacheHeaders(res);
    return res.json({ ok: true, rates: results });
  } catch (err) {
    glog.error('POST /api/pricing/effective-rate/batch error:', err);
    return res.status(500).json({ ok: false, error: 'internal error' });
  }
});

export default router;
