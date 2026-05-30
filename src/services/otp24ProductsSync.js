// src/services/otp24ProductsSync.js
import { getOtp24Products } from '../lib/otp24Adapter.js';
import { refreshOtp24BalanceOnce } from '../lib/otp24BalanceUtil.js';
import { Otp24Product } from '../models/Otp24Product.js';
import { Otp24Setting } from '../models/Otp24Setting.js';
import { config } from '../config.js';

function nz(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}


export function compactOtp24ProductRaw(raw = {}) {
  const r = raw?.raw && typeof raw.raw === 'object' ? raw.raw : raw;
  const pick = (...keys) => {
    for (const k of keys) {
      const v = r?.[k] ?? raw?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  };
  const out = {
    id: pick('id', '_id', 'service_id'),
    type: pick('type', 'type_code', 'typeCode', 'code'),
    type_code: pick('type_code', 'typeCode', 'type', 'code'),
    code: pick('code', 'type_code', 'typeCode', 'type'),
    name: pick('name', 'title'),
    app: pick('app', 'category'),
    category: pick('category', 'app'),
    country: pick('country'),
    price: pick('price', 'basePrice', 'providerPrice'),
    amount: pick('amount', 'stock', 'remain', 'remaining'),
    stock: pick('stock', 'amount', 'remain', 'remaining'),
    sold: pick('sold', 'sale', 'sales'),
    sale: pick('sale', 'sold', 'sales'),
    img: pick('img', 'image', 'icon', 'logo'),
    image: pick('image', 'img', 'icon', 'logo'),
    exp: pick('exp', 'expire'),
    msg: pick('msg', 'detail', 'description'),
    detail: pick('detail', 'msg', 'description'),
    description: pick('description', 'detail', 'msg'),
  };
  for (const k of Object.keys(out)) {
    if (out[k] === undefined || out[k] === null || String(out[k]).length > 1200) delete out[k];
  }
  return out;
}

function pickIdentity(it = {}) {
  const extId = [it.extId, it.itemId, it.id, it.code, it.typeCode, it.raw?.type_code, it.raw?.service_id, it.raw?.id]
    .find(v => v !== undefined && v !== null && String(v).trim() !== '');
  const code = [it.code, it.typeCode, it.itemId, it.id]
    .find(v => v !== undefined && v !== null && String(v).trim() !== '');
  const name = String(it.name || it.title || it.raw?.name || 'Unknown').trim();

  const filter = { provider: 'otp24' };
  if (extId) filter.extId = String(extId);
  else if (code) filter.code = String(code);
  else filter.name = name || '(unnamed)';

  return { extId, code, name, filter };
}

function buildProductSet(it = {}, addPerc = 35, now = new Date()) {
  const { extId, code, name } = pickIdentity(it);
  const sourceImg = it.imageSourceUrl || it.img || it.raw?.img || it.raw?.image || it.raw?.icon || it.raw?.logo;
  const amount = Math.max(0, Math.floor(nz(it.amount ?? it.raw?.amount ?? it.raw?.stock ?? it.stock, 0)));

  const $set = {
    productKind: it.productKind || 'otp',
    app: it.app || it.raw?.app || it.raw?.category || '',
    name: name || '(unnamed)',
    providerPrice: nz(it.providerPrice ?? it.basePrice, 0),
    basePrice: nz(it.basePrice ?? it.providerPrice, 0),
    salePrice: nz(it.salePrice ?? it.price, 0),
    price: nz(it.salePrice ?? it.price, 0),
    markupPercent: nz(it.markupPercent ?? addPerc, addPerc),
    currency: it.currency || 'THB',
    country: it.country || it.raw?.country,
    category: (it.category || it.raw?.category || it.app || 'otp').toString().toLowerCase(),
    img: sourceImg,
    imageSourceUrl: sourceImg,
    exp: it.exp || it.raw?.exp || it.raw?.expire,

    // สำคัญ: amount คือจำนวนคงเหลือจริงจาก OTP24 API ตอน sync ล่าสุด
    // ไม่ใช่ base stock ที่ต้องเอาไปหักยอดขายเองอีก
    amount,
    sold: Math.max(0, Math.floor(nz(it.sold ?? it.raw?.sold ?? it.raw?.sale ?? it.raw?.sales, 0))),
    msg: it.msg || it.raw?.msg || it.raw?.detail || it.raw?.description || '',
    typeCode: it.typeCode || it.raw?.type_code || undefined,
    raw: compactOtp24ProductRaw(it.raw ?? it),
    syncedAt: now,
    lastProviderStockSyncAt: now,
  };

  if (extId) $set.extId = String(extId);
  if (code) $set.code = String(code);

  Object.keys($set).forEach((key) => {
    if ($set[key] === undefined) delete $set[key];
  });

  const $setOnInsert = { provider: 'otp24' };
  if (sourceImg) $setOnInsert.imageCacheStatus = 'pending';

  return { $set, $setOnInsert };
}

export async function syncOtp24ProductsFromProvider(options = {}) {
  const apiPerc = Number.isFinite(Number(options.apiPerc))
    ? Math.max(0, Number(options.apiPerc))
    : nz(config?.jobs?.otp24ProductsSyncApiPerc, 0);

  const addPerc = Number.isFinite(Number(options.addPerc))
    ? Math.max(0, Number(options.addPerc))
    : nz(config?.jobs?.otp24ProductsSyncAddPerc, 35);

  const now = new Date();
  const r = await getOtp24Products({ apiPerc, addPerc });

  if (!r?.ok || !Array.isArray(r.items)) {
    await Otp24Setting.findOneAndUpdate(
      { name: 'otp24' },
      {
        $set: {
          productsLastSyncAt: now,
          lastSyncError: String(r?.error || 'fetch products failed'),
        },
        $currentDate: { updatedAt: true },
      },
      { upsert: true }
    );
    return { ok: false, error: r?.error || 'fetch products failed', raw: r?.raw || null };
  }

  const ops = [];
  for (const it of r.items) {
    const { filter } = pickIdentity(it);
    const update = buildProductSet(it, addPerc, now);
    ops.push({ updateOne: { filter, update, upsert: true } });
  }

  const bulkRes = ops.length ? await Otp24Product.bulkWrite(ops, { ordered: false }) : null;
  const touched = (bulkRes?.upsertedCount || 0) + (bulkRes?.modifiedCount || 0) + (bulkRes?.matchedCount || 0);
  const total = await Otp24Product.countDocuments({ provider: 'otp24' });
  const packTotal = await Otp24Product.countDocuments({ provider: 'otp24', productKind: 'pack' });

  await Otp24Setting.findOneAndUpdate(
    { name: 'otp24' },
    {
      $set: {
        productsLastSyncAt: now,
        productsLastCount: total,
        productsLastPackCount: packTotal,
        lastSyncError: '',
      },
      $currentDate: { updatedAt: true },
    },
    { upsert: true }
  );

  return {
    ok: true,
    count: touched,
    total,
    packTotal,
    apiPerc,
    addPerc,
    otpCount: r.otpCount || 0,
    packCount: r.packCount || 0,
  };
}

export async function syncOtp24ProductsAndBalance(options = {}) {
  const products = await syncOtp24ProductsFromProvider(options);
  let balance = null;
  try {
    balance = await refreshOtp24BalanceOnce();
  } catch (e) {
    balance = { ok: false, error: e?.message || String(e) };
  }

  // ✅ Flatten result for admin/manual sync callers while keeping raw products result.
  return {
    ok: !!products?.ok,
    total: Number(products?.total || 0),
    fetched: Number(products?.fetched || 0),
    upserted: Number(products?.upserted || 0),
    active: Number(products?.active || 0),
    inactive: Number(products?.inactive || 0),
    lastSyncAt: products?.lastSyncAt || null,
    products,
    balance,
  };
}
