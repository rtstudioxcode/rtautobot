// src/routes/apps.js
import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { Otp24Product } from '../models/Otp24Product.js';
import { Otp24AppsOrder } from '../models/Otp24AppsOrder.js';
// Image binary cache is intentionally disabled. Product images must not be stored in MongoDB or Redis.
import { User } from '../models/User.js';
import { buyPack, getOtp24Mail, getOtp24TwoFa } from '../lib/otp24Adapter.js';
import { refreshOtp24BalanceAsync } from '../lib/otp24BalanceUtil.js';
import { recalcUserTotals } from '../services/spend.js';
import { config } from '../config.js';
import { seoMeta } from '../lib/seo.js';
import { refreshOtp24AppsOrderFromProvider, stripOtp24SupportLines } from '../services/otp24AppsOrderRefresh.js';

const router = Router();

// Short in-process cache for public-ish Apps catalog data.
// Buyer history and orders remain private/no CDN; catalog/images can be cached safely.
const APPS_CATALOG_TTL_MS = 5 * 60 * 1000;
const APPS_HISTORY_BROWSER_TTL = 20;
const appsSummaryCache = new Map();
const appsProductsCache = new Map();
const APPS_PRODUCT_PUBLIC_FIELDS = {
  provider: 1,
  productKind: 1,
  extId: 1,
  itemId: 1,
  code: 1,
  typeCode: 1,
  app: 1,
  name: 1,
  providerPrice: 1,
  basePrice: 1,
  salePrice: 1,
  price: 1,
  markupPercent: 1,
  currency: 1,
  country: 1,
  category: 1,
  img: 1,
  imageSourceUrl: 1,
  exp: 1,
  amount: 1,
  sold: 1,
  msg: 1,
  syncedAt: 1,
  updatedAt: 1,
  // Keep only compact provider metadata. Do not select legacy imageCachedPath/key;
  // those may point to MongoDB-backed image buffers and increase egress.
};

function memGet(map, key, ttl = APPS_CATALOG_TTL_MS) {
  const row = map.get(key);
  if (!row) return null;
  if (Date.now() - row.t > ttl) { map.delete(key); return null; }
  return row.data;
}
function memSet(map, key, data) { map.set(key, { t: Date.now(), data }); }
function weakEtag(value) {
  return 'W/"' + crypto.createHash('sha1').update(JSON.stringify(value || '')).digest('hex') + '"';
}
function sendJsonWithEtag(req, res, payload, { privateCache = true, seconds = 120 } = {}) {
  const etag = weakEtag(payload);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', `${privateCache ? 'private' : 'public'}, max-age=${Math.max(0, Number(seconds)||0)}, stale-while-revalidate=${Math.max(60, Number(seconds)||0)}`);
  if (privateCache) res.setHeader('Vary', 'Cookie');
  if (String(req.headers['if-none-match'] || '').split(',').map(v => v.trim()).includes(etag)) {
    return res.status(304).end();
  }
  return res.json(payload);
}

const OTP24_IMAGE_HOST = 'https://otp24hr.com';

function normalizeOtp24ImageUrl(raw = '') {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  if (v.startsWith('/')) return `${OTP24_IMAGE_HOST}${v}`;
  return `${OTP24_IMAGE_HOST}/views/assets/image/ico/${v.replace(/^\/+/, '')}`;
}

function isInternalOtp24ImagePath(v = '') {
  const s = String(v || '').trim();
  return !s
    || s === '/static/logo/icon-logo.png'
    || /^\/(?:apps\/img|static\/cache\/otp24-apps)\//i.test(s)
    || /^https?:\/\/[^/]+\/(?:apps\/img|static\/cache\/otp24-apps)\//i.test(s);
}

function resolveOtp24ProductImageSource(product = {}) {
  const raw = product.raw || {};
  // ห้ามเอา imageCachedPath หรือ /apps/img/:id กลับมาใช้ เพราะจะทำให้รูปไหลผ่าน backend/DB อีก
  const candidates = [
    product.imageSourceUrl,
    raw.img,
    raw.image,
    raw.icon,
    raw.logo,
    product.img,
  ];

  for (const item of candidates) {
    const v = String(item || '').trim();
    if (!v || isInternalOtp24ImagePath(v)) continue;
    const url = normalizeOtp24ImageUrl(v);
    if (url && !isInternalOtp24ImagePath(url)) return url;
  }
  return '';
}

const MARKUP_PERCENT = 35;

const isGlobalLogEnabled = () => config?.system?.globalLogEnabled === true;
const glog = {
  error: (...args) => { if (isGlobalLogEnabled()) console.error(...args); },
  warn:  (...args) => { if (isGlobalLogEnabled()) console.warn(...args); },
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function numOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getProductBaseStock(prod = {}) {
  // amount จาก getpack = stock จากต้นทางตอน sync ล่าสุด
  return Math.max(0, Math.floor(numOrZero(prod.amount ?? prod.raw?.amount ?? prod.stock ?? prod.raw?.stock ?? 0)));
}

function getProductLegacySold(prod = {}) {
  // ใช้เป็น fallback เท่านั้น — source of truth ใหม่คือ otp24appsorders
  return Math.max(0, Math.floor(numOrZero(prod.sold ?? prod.raw?.sold ?? prod.raw?.sale ?? 0)));
}

function applySoldStock(prod = {}, soldCount = null) {
  // amount ใน otp24products คือจำนวนคงเหลือจริงจาก provider/local stock snapshot
  // ห้ามนำยอดขายจาก otp24appsorders มาหักซ้ำ ไม่งั้น stock หน้าเว็บจะเพี้ยนจาก API
  const amount = getProductBaseStock(prod);
  const sold = Math.max(0, Math.floor(Number(soldCount ?? getProductLegacySold(prod)) || 0));
  return { baseStock: amount, sold, amount, isOutOfStock: amount <= 0 };
}

function asSoldKey(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function soldKeyVariants(value) {
  const s = asSoldKey(value);
  if (!s) return [];
  const out = new Set([s]);
  if (/^-?\d+(?:\.0+)?$/.test(s)) out.add(String(Number(s)));
  return Array.from(out).filter(Boolean);
}

function productSoldKeys(product = {}) {
  const raw = product.raw || {};
  const values = [
    product._id,
    product.productId,
    product.serviceCode,
    product.typeCode,
    product.code,
    product.itemId,
    product.providerServiceId,
    raw.type_code,
    raw.typeCode,
    raw.serviceCode,
    raw.code,
    raw.itemId,
    raw.id,
  ];

  const keys = new Set();
  for (const value of values) {
    for (const key of soldKeyVariants(value)) keys.add(key);
  }
  return Array.from(keys);
}

async function getSoldMap(productRefs = []) {
  const products = (Array.isArray(productRefs) ? productRefs : [])
    .filter(Boolean)
    .map((item) => (typeof item === 'object' && !Array.isArray(item) ? item : { _id:item }));

  const soldByProductId = new Map();
  if (!products.length) return soldByProductId;

  const keyToProductIds = new Map();
  const productIds = [];
  const codeValues = [];

  for (const product of products) {
    const productId = asSoldKey(product._id || product.productId);
    if (!productId) continue;
    soldByProductId.set(productId, 0);
    productIds.push(productId);

    for (const key of productSoldKeys(product)) {
      if (!keyToProductIds.has(key)) keyToProductIds.set(key, new Set());
      keyToProductIds.get(key).add(productId);
      if (key !== productId) codeValues.push(key);
    }
  }

  const idList = Array.from(new Set(productIds));
  const codeList = Array.from(new Set(codeValues));
  if (!idList.length && !codeList.length) return soldByProductId;

  const numericCodes = codeList
    .map(v => (/^-?\d+(?:\.0+)?$/.test(String(v)) ? Number(v) : null))
    .filter(v => Number.isFinite(v));
  const codeMatchList = Array.from(new Set([...codeList, ...numericCodes]));

  const or = [];
  if (idList.length) or.push({ productId:{ $in:idList } });
  if (codeMatchList.length) {
    or.push({ serviceCode:{ $in:codeMatchList } });
    or.push({ typeCode:{ $in:codeMatchList } });
    or.push({ code:{ $in:codeMatchList } });
  }

  const rows = await Otp24AppsOrder.find({
    ...(or.length ? { $or:or } : {}),
    status:{ $nin:['failed','cancelled','canceled','refunded','rejected'] },
  }).select('productId serviceCode typeCode code quantity status').lean().catch(() => []);

  for (const row of rows || []) {
    const rowKeys = new Set();
    for (const value of [row.productId, row.serviceCode, row.typeCode, row.code]) {
      for (const key of soldKeyVariants(value)) rowKeys.add(key);
    }

    const targetIds = new Set();
    for (const key of rowKeys) {
      const matched = keyToProductIds.get(key);
      if (matched) matched.forEach(id => targetIds.add(id));
    }

    if (!targetIds.size) continue;
    const qty = Math.max(1, Math.floor(Number(row.quantity || 1)));
    targetIds.forEach((id) => {
      soldByProductId.set(id, Number(soldByProductId.get(id) || 0) + qty);
    });
  }

  return soldByProductId;
}

function escRx(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function stripHtml(s = '') {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normKey(s = '') {
  return stripHtml(s).toLowerCase();
}

const CATEGORY_LABELS = {
  all: 'ทั้งหมด',
  ai: 'AI Tools',
  account: 'แอคเคาท์',
  streaming: 'สตรีมมิ่ง',
  vpn: 'VPN',
  software: 'Software',
};


// ซ่อนสินค้าแพ็กภายในของ OTP24HR ไม่ให้ขึ้นหน้า /apps
// เช่น OTP24HR Hub และแพ็กชื่อ basic / standard / exclusive
const HIDDEN_PACK_RX = /(?:otp24hr\s*hub|\b(?:basic|standard|exclusive)\b)/i;

function packSearchBlob(row = {}) {
  const raw = row.raw || {};
  return normKey([
    row.app, raw.app,
    row.category, raw.category,
    row.name, raw.name,
    row.serviceCode, row.typeCode, row.code,
    raw.serviceCode, raw.typeCode, raw.type_code, raw.code,
    row.msg, raw.msg, raw.detail, raw.description,
  ].filter(v => v !== null && v !== undefined).join(' '));
}

function isHiddenPackProduct(row = {}) {
  return HIDDEN_PACK_RX.test(packSearchBlob(row));
}

const PLATFORM_ICON_META = {
  netflix: { label:'NETFLIX', sub:'Premium', bg1:'#171717', bg2:'#050505', fg:'#e50914' },
  hbomax: { label:'HBO', sub:'MAX', bg1:'#2d255d', bg2:'#0a071b', fg:'#bba7ff' },
  monomax: { label:'Mono', sub:'Max', bg1:'#202020', bg2:'#090909', fg:'#f2c94c' },
  'x-twitter': { label:'X', sub:'Twitter', bg1:'#1f1f1f', bg2:'#030303', fg:'#ffffff' },
  spotify: { label:'Spotify', sub:'Music', bg1:'#0f3d22', bg2:'#061b10', fg:'#1ed760' },
  'prime-video': { label:'prime', sub:'video', bg1:'#146eb4', bg2:'#0a2f58', fg:'#ffffff' },
  'apple-music': { label:'Apple', sub:'Music', bg1:'#fa526d', bg2:'#7e1730', fg:'#ffffff' },
  'bilibili-30': { label:'bilibili', sub:'30', bg1:'#31baf2', bg2:'#0b5d8f', fg:'#ffffff' },
  iqiyi: { label:'iQIYI', sub:'', bg1:'#00e34f', bg2:'#053816', fg:'#06140b' },
  youtube: { label:'YouTube', sub:'', bg1:'#ff2d2d', bg2:'#6a0505', fg:'#ffffff' },
  facebook: { label:'Facebook', sub:'', bg1:'#1877f2', bg2:'#0a2d61', fg:'#ffffff' },
  instagram: { label:'Instagram', sub:'', bg1:'#f77737', bg2:'#833ab4', fg:'#ffffff' },
  tiktok: { label:'TikTok', sub:'', bg1:'#111111', bg2:'#000000', fg:'#ffffff' },
  telegram: { label:'Telegram', sub:'', bg1:'#2aabee', bg2:'#0d5278', fg:'#ffffff' },
  gmail: { label:'Gmail', sub:'', bg1:'#ffffff', bg2:'#e9eef7', fg:'#d93025' },
};

function platformIconPath(platform = '') {
  const slug = appSlug(platform || 'other');
  return `/apps/icon/${encodeURIComponent(slug)}`;
}

function imageVersionValue(product = {}) {
  const cachedAt = product?.imageCachedAt ? new Date(product.imageCachedAt).getTime() : 0;
  const updatedAt = product?.updatedAt ? new Date(product.updatedAt).getTime() : 0;
  const syncedAt = product?.syncedAt ? new Date(product.syncedAt).getTime() : 0;
  return String(product.imageCacheKey || cachedAt || updatedAt || syncedAt || '1');
}

function withImageVersion(url = '', product = {}) {
  const u = String(url || '').trim();
  if (!u) return '';
  // ใส่ version เฉพาะรูปที่ proxy ผ่านเว็บเรา เพื่อแก้ browser cache เก่าที่เคยจำ fallback robot ไว้
  if (!/^\/apps\/img\//i.test(u)) return u;
  const sep = u.includes('?') ? '&' : '?';
  return `${u}${sep}v=${encodeURIComponent(imageVersionValue(product))}`;
}

function appImageUrl(product = {}, fallback = '') {
  // ลดค่า MongoDB egress: อย่าให้รูปสินค้าไหลผ่าน /apps/img/:id แล้วต้อง query DB ทุกภาพ
  // ใช้ URL รูปต้นทางที่ sync มาไว้ใน product โดยตรง; ถ้าไม่มีค่อย fallback เป็น logo/platform icon
  const direct = resolveOtp24ProductImageSource(product);
  return direct || fallback || platformIconPath(detectPlatform(product || {})) || '/static/logo/icon-logo.png';
}

function setNoStoreImage(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function setPrivateCatalogCache(res, seconds = 120) {
  const ttl = Math.max(30, Math.min(600, Number(seconds) || 120));
  // ข้อมูลสินค้า/หมวดหมู่ไม่ใช่ข้อมูลส่วนตัว แต่ API ต้อง login จึงใช้ private cache
  // ลดการยิงซ้ำจาก browser โดยไม่เปิด cache ข้ามผู้ใช้ที่ CDN
  res.setHeader('Cache-Control', `private, max-age=${ttl}, stale-while-revalidate=300`);
  res.setHeader('Vary', 'Cookie');
}

const imageOriginBudget = { minute: 0, count: 0 };
function canFetchOtp24OriginImage() {
  const perMinute = Math.max(1, Number(config?.jobs?.otp24ImageFetchPerMinute || 12));
  const minute = Math.floor(Date.now() / 60000);
  if (imageOriginBudget.minute !== minute) {
    imageOriginBudget.minute = minute;
    imageOriginBudget.count = 0;
  }
  if (imageOriginBudget.count >= perMinute) return false;
  imageOriginBudget.count += 1;
  return true;
}

function setSoftFallbackImageCache(res) {
  // กันหน้าเว็บยิงรูปเดิมถี่ ๆ ตอน cache ต้นทางยังไม่พร้อม
  res.setHeader('Cache-Control', 'public, max-age=300');
}

function setLongImageCache(res, cacheKey = '') {
  // รูป /apps/img มี ?v=imageCacheKey อยู่แล้ว จึง cache ได้ยาวแบบ immutable
  // ช่วยให้ browser/CDN ใช้ cache ฝั่งผู้ใช้ก่อน ไม่ยิง Railway ซ้ำทุก refresh
  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=604800, immutable');
  if (cacheKey) res.setHeader('ETag', `"otp24-img-${cacheKey}"`);
}

function isFreshImageRequest(req, cacheKey = '') {
  const etag = `"otp24-img-${cacheKey}"`;
  const inm = String(req.headers['if-none-match'] || '');
  return cacheKey && inm.split(',').map(v => v.trim()).includes(etag);
}

function xmlEsc(s = '') {
  return String(s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[ch]));
}

function svgIconForSlug(slug = '') {
  const key = appSlug(slug || 'other');
  const meta = PLATFORM_ICON_META[key] || { label:String(slug || 'APP').replace(/-/g, ' ').toUpperCase().slice(0, 12), sub:'Premium', bg1:'#2a2112', bg2:'#080808', fg:'#f7d774' };
  const label = xmlEsc(meta.label || 'APP');
  const sub = xmlEsc(meta.sub || '');
  const bg1 = xmlEsc(meta.bg1 || '#2a2112');
  const bg2 = xmlEsc(meta.bg2 || '#080808');
  const fg = xmlEsc(meta.fg || '#f7d774');
  const labelSize = label.length > 9 ? 23 : label.length > 6 ? 28 : 38;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${fg}" stop-opacity=".38"/><stop offset="1" stop-color="${fg}" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity=".45"/></filter>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <rect x="26" y="26" width="460" height="460" rx="92" fill="none" stroke="${fg}" stroke-opacity=".28" stroke-width="4"/>
  <circle cx="256" cy="205" r="190" fill="url(#glow)"/>
  <g filter="url(#shadow)">
    <text x="256" y="246" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${labelSize}" font-weight="900" fill="${fg}" letter-spacing="-1">${label}</text>
    ${sub ? `<text x="256" y="302" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="${fg}" opacity=".86">${sub}</text>` : ''}
  </g>
</svg>`;
}


function detectLeadingPlatform(row = {}) {
  const raw = row.raw || {};
  const name = normKey(row.name || raw.name || '');

  // แยก YouTube / Gemini ตามชื่อสินค้าเป็นหลัก:
  // - ถ้าชื่อขึ้นต้นด้วย YouTube ให้จัดเป็น YouTube แม้มีคำว่า Gemini ต่อท้าย
  // - ถ้าชื่อขึ้นต้นด้วย Gemini ให้จัดเป็น Gemini แม้มีคำว่า YouTube ต่อท้าย
  // วิธีนี้กันสินค้าบันเดิลปนกันผิดหมวดจาก keyword ที่อยู่กลางชื่อ
  if (/^youtube(?:\b|[\s&+()/\-–—])/i.test(name)) return 'YouTube';
  if (/^gemini(?:\b|[\s&+()/\-–—])/i.test(name)) return 'Gemini';
  return '';
}


function detectCategory(row = {}) {
  const raw = row.raw || {};
  const leadingPlatform = detectLeadingPlatform(row);
  if (leadingPlatform === 'YouTube') return 'streaming';
  if (leadingPlatform === 'Gemini') return 'ai';

  const blob = normKey([row.app, raw.app, row.category, raw.category, row.name, raw.name].join(' '));
  if (/vpn/.test(blob)) return 'vpn';
  if (/gmail/.test(blob)) return 'account';
  if (/stream|netflix|youtube|spotify|disney|prime|viu|iqiyi|wetv|bein|ดูหนัง|สตรีม/.test(blob)) return 'streaming';
  if (/ai|chatgpt|claude|gemini|gpt|midjourney|copilot|perplexity|hailuo|vsco/.test(blob)) return 'ai';
  if (/software|windows|office|adobe|capcut|canva|license|key|โปรแกรม/.test(blob)) return 'software';
  return 'account';
}

function detectPlatform(row = {}) {
  const raw = row.raw || {};
  const name = stripHtml(row.name || raw.name || '');
  const category = stripHtml(row.app || raw.app || row.category || raw.category || '');
  const blob = normKey([name, category, raw.msg, row.msg].join(' '));

  const leadingPlatform = detectLeadingPlatform(row);
  if (leadingPlatform) return leadingPlatform;

  const rules = [
    ['Zoom', /zoom/],
    ['Facebook', /facebook|เฟสบุ๊ค|เฟส|fb|business manager/],
    ['YouTube', /youtube/],
    ['Gmail', /gmail|google mail/],
    ['GMX', /gmx\b/],
    ['Instagram', /instagram|ไอจี|ig\b/],
    ['X (Twitter)', /(?:^|\b)x\s*(?:\(|twitter|ทวิต)|twitter|ทวิต/],
    ['OnlyFans', /onlyfans/],
    ['TikTok', /tiktok|ติ๊กต็อก/],
    ['Telegram', /telegram/],
    ['Netflix', /netflix/],
    ['MonoMax', /monomax/],
    ['HBOMAX', /hbo\b/],
    ['VSCO', /vsco\b/],
    ['Copilot', /copilot/],
    ['ChatGPT', /chatgpt|openai|gpt/],
    ['Gemini', /gemini/],
    ['Hailuo', /hailuo/],
    ['Claude', /claude/],
    ['CapCut', /capcut/],
    ['Outlook', /outlook|hotmail/],
    ['Discord', /discord/],
    ['Spotify', /spotify/],
    ['iQIYI', /iqiyi/],
    ['WeTV', /wetv/],
    ['Viu', /viu/],
    ['LINE', /line\b/],
    ['Rambler', /rambler/],
    ['Garena', /garena/],
    ['Bitkub Next', /bitkub/],
    ['GNJOY', /gnjoy/],
    ['Playpark', /playpark/],
  ];
  for (const [label, rx] of rules) if (rx.test(blob)) return label;

  // ใช้ชื่อช่วงแรกเป็นชื่อแพลตฟอร์ม ไม่ใช้ category เช่น account/streaming
  const clean = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[-–—|:]+/g, ' ')
    .replace(/\b(แอคใหม่|แอคเก่า|แอคแข็ง|บัญชีใหม่|รับประกัน|พร้อมใช้|รายเดือน)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const first = clean.split(/\s+/).slice(0, 2).join(' ').trim();
  return first || category || 'อื่น ๆ';
}


function appSlug(name = '') {
  const base = String(name || 'other')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9ก-๙]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'other';
}

function pickAppImage(products = []) {
  const found = products.find(p => p.img || p.raw?.img || p.raw?.image);
  return found?.img || found?.raw?.img || found?.raw?.image || '';
}

function publicProduct(p = {}, soldCount = null) {
  const raw = p.raw || {};
  const stock = applySoldStock(p, soldCount);
  const providerPrice = Number(p.providerPrice ?? p.basePrice ?? raw.price ?? 0);
  const storedSale = Number(p.salePrice ?? p.price ?? 0);
  // ใช้ markup ปัจจุบัน 35% เป็น source of truth สำหรับ pack เสมอ
  // เพื่อไม่ให้ record เก่าที่เคย sync จาก markup เดิม ยังแสดงราคาเก่า
  const salePrice = providerPrice > 0
    ? round2(providerPrice * (1 + MARKUP_PERCENT / 100))
    : round2(storedSale);
  const category = detectCategory(p);
  const platform = detectPlatform(p);
  const id = String(p._id || '');
  const sourceImg = resolveOtp24ProductImageSource(p);
  // Cost guard: never return /apps/img as a product image.
  // Image traffic must go direct to provider URL or static/platform fallback only.
  const cachedImg = '';
  const fallbackImg = platformIconPath(platform);
  return {
    _id: id,
    app: platform,
    platform,
    platformSlug: appSlug(platform),
    category,
    categoryLabel: CATEGORY_LABELS[category] || 'แอคเคาท์',
    providerCategory: p.app || raw.app || p.category || 'account',
    slug: appSlug(platform),
    name: stripHtml(p.name || raw.name || 'ไม่ระบุชื่อสินค้า'),
    typeCode: p.typeCode || p.code || p.itemId || raw.type_code || raw.code || '',
    img: cachedImg || sourceImg || fallbackImg,
    imageUrl: cachedImg || sourceImg || fallbackImg,
    imageSourceUrl: sourceImg,
    imageCachedPath: cachedImg,
    exp: stripHtml(p.exp || raw.exp || raw.expire || ''),
    amount: stock.amount,
    sold: stock.sold,
    baseStock: stock.baseStock,
    isOutOfStock: stock.isOutOfStock,
    msg: p.msg || raw.msg || raw.detail || raw.description || '',
    msgText: stripHtml(p.msg || raw.msg || raw.detail || raw.description || ''),
    providerPrice,
    salePrice,
    markupPercent: MARKUP_PERCENT,
    currency: p.currency || 'THB',
  };
}


function publicBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function safePathPart(v) {
  try { return encodeURIComponent(decodeURIComponent(String(v || '').trim())); }
  catch { return encodeURIComponent(String(v || '').trim()); }
}

function rewriteOtp24ToolLinks(text = '', req) {
  const base = publicBaseUrl(req);
  if (!base) return String(text || '');
  const src = String(text || '');

  // แปลงลิงก์ tool ที่ถูกบันทึกใน DB จากทุก host เดิม
  // เช่น localhost, otp24hr.com หรือโดเมนเก่า ให้กลายเป็น origin ปัจจุบันของเว็บที่ผู้ใช้เปิดอยู่
  return src
    .replace(/https?:\/\/[^\s<>'"|]+\/mailz\/([^\s<>'"|]+)/gi, (_, mail) => `${base}/mailz/${safePathPart(mail)}`)
    .replace(/https?:\/\/[^\s<>'"|]+\/mails\b/gi, `${base}/mails`)
    .replace(/https?:\/\/[^\s<>'"|]+\/2fa\/([^\s<>'"|]+)/gi, (_, g) => `${base}/2fa/${safePathPart(g)}`);
}

function looksLikeAppsRefund(text = '') {
  return /(?:คืน\s*(?:เครดิต|เงิน)|refund(?:ed)?|สินค้ามีปัญหา)/i.test(stripHtml(String(text || '')));
}

function normalizeAppsRefundDisplayText(text = '', amount = 0) {
  const refundAmount = Number(amount || 0);
  if (!refundAmount || !looksLikeAppsRefund(text)) return text;
  const amountText = refundAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rx = /((?:^|\n|<br\s*\/?\s*>|&lt;br\s*\/?\s*&gt;)\s*[-–—•]?\s*คืน\s*(?:เครดิต|เงิน)\s*[:：]\s*)(?:฿\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:เครดิต|บาท|THB)?/gi;
  if (rx.test(String(text || ''))) return String(text || '').replace(rx, `$1${amountText} เครดิต`);
  return String(text || '');
}

const APPS_WAITING_DETAIL_LINE_RX = /(?:เจ้าหน้าที่[\s\S]{0,120}กำลัง[\s\S]{0,120}ดำเนินการ[\s\S]{0,120}ส่ง[\s\S]{0,80}ข้อม(?:ู|ู|ลู|ูล)?สินค้า|กรุณาเช็ค[\s\S]{0,120}ประวัติสินค้า[\s\S]{0,80}(?:15\s*นาที|ข้อมูลล่าสุด)|ภายใน\s*24\s*(?:ชม\.?|ชั่วโมง))/i;

function isAppsWaitingDetailLine(line = '') {
  return APPS_WAITING_DETAIL_LINE_RX.test(String(line || ''));
}

function removeAppsWaitingDetailLines(text = '') {
  return String(text || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&lt;br\s*\/?\s*&gt;/gi, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line && !isAppsWaitingDetailLine(line))
    .join('\n')
    .trim();
}

function buildAppsRefundSafeDetailText(text = '', amount = 0, refunded = false) {
  const refundAmount = Number(amount || 0);
  let out = String(text || '');
  if (refunded) out = removeAppsWaitingDetailLines(out);
  out = normalizeAppsRefundDisplayText(out, refundAmount);

  if (refunded && refundAmount > 0 && !/(?:คืน\s*(?:เครดิต|เงิน)|refund(?:ed)?|สินค้ามีปัญหา)/i.test(out)) {
    const amountText = refundAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    out = compactAppsDetailText(`${out ? `${out}\n` : ''}สินค้ามีปัญหา\n- คืนเครดิต : ${amountText} เครดิต`);
  }
  return out;
}

function compactAppsDetailText(value = '') {
  const lines = stripOtp24SupportLines(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&lt;br\s*\/?\s*&gt;/gi, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^\.?\/?logstext\//i.test(line))
    .filter(line => !/\/logstext\/[^\s]+\.txt/i.test(line));
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line
      .replace(/\s+/g, ' ')
      .replace(/(?:คืน\s*(?:เครดิต|เงิน)\s*[:：]\s*)(?:฿\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:เครดิต|บาท|THB)?/i, 'คืนเครดิต:AMOUNT')
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join('\n').trim();
}

function extractToolHints(text = '') {
  const s = String(text || '');
  const mail =
    (s.match(/(?:เมล|mail|email)\s*[:：]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i) || [])[1] ||
    (s.match(/https?:\/\/[^\s<>'"]+\/mailz\/([^\s<>'"]+)/i) || [])[1] ||
    '';
  const twoFa =
    (s.match(/2FA\s*[:：]\s*([A-Z2-7a-z0-9\s]{12,})/i) || [])[1] ||
    (s.match(/https?:\/\/[^\s<>'"]+\/2fa\/([^\s<>'"]+)/i) || [])[1] ||
    '';
  return {
    mail: mail ? decodeURIComponent(String(mail).trim()) : '',
    twoFa: twoFa ? decodeURIComponent(String(twoFa).trim()).replace(/\s+/g, '') : '',
  };
}

function publicOrder(o = {}, req = null) {
  const rawAccountText = stripOtp24SupportLines(req ? rewriteOtp24ToolLinks(o.accountText || '', req) : (o.accountText || ''));
  const rawLinkText = stripOtp24SupportLines(req ? rewriteOtp24ToolLinks(o.linkText || '', req) : (o.linkText || ''));
  const rawMessage = stripOtp24SupportLines(req ? rewriteOtp24ToolLinks(o.message || '', req) : (o.message || ''));
  const rawAll = [rawAccountText, rawLinkText, rawMessage, o.providerRaw?.msg, o.providerRaw?.textid, o.providerRaw?.linkz].filter(Boolean).join('\n');
  const effectiveRefunded = o.refundApplied === true || String(o.status || '').toLowerCase() === 'refunded' || looksLikeAppsRefund(rawAll);
  const refundDisplayAmount = effectiveRefunded ? (Number(o.refundAmount || 0) || Number(o.salePrice || 0)) : 0;
  const accountText = compactAppsDetailText(buildAppsRefundSafeDetailText(rawAccountText, refundDisplayAmount, effectiveRefunded));
  const linkText = compactAppsDetailText(buildAppsRefundSafeDetailText(rawLinkText, refundDisplayAmount, effectiveRefunded));
  const message = compactAppsDetailText(buildAppsRefundSafeDetailText(rawMessage, refundDisplayAmount, effectiveRefunded));

  return {
    _id: String(o._id),
    orderId: o.orderId || String(o._id),
    productId: o.productId ? String(o.productId) : '',
    appName: o.appName || '',
    serviceCode: o.serviceCode || '',
    quantity: Number(o.quantity || 1),
    providerPrice: effectiveRefunded ? 0 : Number(o.providerPrice || 0),
    salePrice: Number(o.salePrice || 0),
    profit: effectiveRefunded ? 0 : Number(o.profit || 0),
    refundApplied: effectiveRefunded,
    refundAmount: refundDisplayAmount,
    refundedAt: o.refundedAt || null,
    refundNote: o.refundNote || '',
    status: effectiveRefunded ? 'refunded' : (o.status || 'success'),
    accountText,
    linkText,
    message,
    toolHints: extractToolHints([accountText, linkText, message].filter(Boolean).join('\n')),
    createdAt: o.createdAt || o.created_at || o.updatedAt,
  };
}

async function getAppsSummary() {
  const cached = memGet(appsSummaryCache, 'summary', 2 * 60 * 1000);
  if (cached) return cached;

  const rowsRaw = await Otp24Product.find({ provider: 'otp24', productKind: 'pack' }, APPS_PRODUCT_PUBLIC_FIELDS)
    .sort({ app: 1, sold: -1, amount: -1, name: 1 })
    .lean();
  const rows = rowsRaw.filter(row => !isHiddenPackProduct(row));

  const soldMap = await getSoldMap(rows);
  const map = new Map();

  for (const row of rows) {
    const p = publicProduct(row, soldMap.get(String(row._id)));
    const key = p.platform || 'อื่น ๆ';
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        slug: appSlug(key),
        category: p.category,
        categoryLabel: p.categoryLabel,
        count: 0,
        stock: 0,
        sold: 0,
        minPrice: 0,
        img: '',
        products: [],
      });
    }
    const item = map.get(key);
    item.count += 1;
    item.stock += Number(p.amount || 0);
    item.sold += Number(p.sold || 0);
    item.minPrice = item.minPrice ? Math.min(item.minPrice, Number(p.salePrice || 0)) : Number(p.salePrice || 0);
    if (!item.img && p.img) item.img = p.img;
    item.products.push(p);
  }

  const summary = Array.from(map.values()).map(a => ({
    name: a.name,
    slug: a.slug,
    category: a.category,
    categoryLabel: a.categoryLabel,
    count: a.count,
    stock: a.stock,
    sold: a.sold,
    isOutOfStock: Number(a.stock || 0) <= 0,
    minPrice: round2(a.minPrice),
    img: a.img || pickAppImage(a.products),
  })).sort((a, b) => {
    const order = { account: 1, ai: 2, streaming: 3, vpn: 4, software: 5 };
    return (order[a.category] || 99) - (order[b.category] || 99) || b.count - a.count || a.name.localeCompare(b.name, 'th');
  });
  memSet(appsSummaryCache, 'summary', summary);
  return summary;
}

async function refreshPackOrderFromProvider(order) {
  if (!order?._id) return order;
  const result = await refreshOtp24AppsOrderFromProvider(order);
  if (!result?.ok) return order;
  return result.order || order;
}

function renderAppsPage(res, payload) {
  const selectedName = payload?.selectedApp?.name;
  const seo = selectedName
    ? seoMeta('/apps', {
        title: `${selectedName} แอปพรีเมี่ยมและบัญชีพร้อมใช้ | RTSMM-TH`,
        description: `เลือกซื้อ ${selectedName} และบริการบัญชีพรีเมี่ยมที่เกี่ยวข้องบน RTSMM-TH ใช้งานง่าย ตรวจสอบราคาและสถานะสินค้าได้สะดวก`,
      })
    : seoMeta('/apps');
  return res.render('otp24/apps', {
    ...seo,
    ...payload,
  });
}


// GET /mails และ /mailz/:mail — เครื่องมือดูเมลจาก OTP24 บนโดเมนของเราเอง
router.get(['/mails', '/mailz/:mail'], async (req, res) => {
  const mail = String(req.params.mail || req.query.mail || '').trim();
  return res.render('otp24/mails', {
    ...seoMeta('/mails', { title: mail ? 'ระบบ EMAIL และ OTP Mail | RTSMM-TH' : undefined }),
    mail,
    directMode: Boolean(mail),
  });
});

router.get('/api/otp24-mail', requireAuth, async (req, res) => {
  const mail = String(req.query.mail || '').trim();
  if (!mail) return res.status(400).json({ ok:false, error:'กรุณาระบุอีเมล' });
  const r = await getOtp24Mail({ mail }).catch(e => ({ ok:false, error:e?.message || String(e), items:[] }));
  return res.status(r.ok ? 200 : 502).json(r);
});

// GET /2fa/:g — เครื่องมือดูรหัส 2FA จาก OTP24 บนโดเมนของเราเอง
router.get(['/2fa', '/2fa/:g'], async (req, res) => {
  const secret = String(req.params.g || req.query.g || '').trim();
  return res.render('otp24/twofa', {
    ...seoMeta('/2fa'),
    secret,
  });
});

router.get('/api/otp24-2fa', requireAuth, async (req, res) => {
  const g = String(req.query.g || '').trim();
  if (!g) return res.status(400).json({ ok:false, error:'กรุณาระบุ 2FA Secret' });
  const r = await getOtp24TwoFa({ g }).catch(e => ({ ok:false, status:'error', error:e?.message || String(e), code:'' }));
  return res.status(r.ok ? 200 : 502).json(r);
});

// GET /apps/icon/:slug — fallback logo ของแอป กรณีต้นทางไม่มีรูป
router.get('/apps/icon/:slug', async (req, res) => {
  const slug = String(req.params.slug || 'other').trim() || 'other';
  res.type('image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800, immutable');
  return res.send(svgIconForSlug(slug));
});

// GET /apps — หน้าเลือกแพลตฟอร์ม/แอพเท่านั้น
router.get('/apps', async (req, res) => {
  const tab = String(req.query.tab || 'shop').toLowerCase() === 'history' ? 'history' : 'shop';
  const q = String(req.query.q || '').trim();
  const cat = String(req.query.cat || 'all').toLowerCase();
  const apps = await getAppsSummary();
  const filteredApps = apps.filter(a => {
    const okCat = cat === 'all' || a.category === cat;
    const okQ = !q || [a.name, a.slug, a.categoryLabel].join(' ').toLowerCase().includes(q.toLowerCase());
    return okCat && okQ;
  });

  return renderAppsPage(res, {
    mode: 'apps',
    apps,
    filteredApps,
    products: [],
    selectedApp: null,
    selectedSlug: '',
    q,
    cat,
    categories: CATEGORY_LABELS,
    tab,
  });
});

// GET /apps/api/history
// โหลดประวัติจาก DB เท่านั้น — การอัปเดตรายละเอียดสินค้าทำโดย background job / queue
// ผู้ใช้ไม่ต้องเปิดหน้า /apps และไม่ต้องกดรีเฟรชเพื่อให้ระบบยิง API
router.get('/apps/api/history', requireAuth, async (req, res) => {
  // Buyer history must always be fresh. The browser previously used force-cache
  // and could keep an old response for a short window, so a newly purchased Apps
  // order appeared in admin but not on /apps?tab=history. Keep this endpoint
  // private and no-store; catalog/product APIs can still be cached separately.
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', 'Cookie');

  const ordersRaw = await Otp24AppsOrder.find({ user: req.user?._id })
    .select('_id provider productId appName serviceCode quantity providerPrice salePrice profit markupPercent orderId status accountText linkText message refundApplied refundAmount refundedAt refundNote createdAt updatedAt')
    .sort({ createdAt: -1, updatedAt: -1 })
    .limit(100)
    .lean();

  return res.json({ ok:true, orders:ordersRaw.map(o => publicOrder(o, req)) });
});

// GET /apps/img/:productId
// Legacy endpoint only. Do NOT query MongoDB here; old browser/CDN cache may still request this route.
// Returning a static fallback stops MongoDB egress spikes from image traffic.
router.get('/apps/img/:productId', (req, res) => {
  setSoftFallbackImageCache(res);
  res.setHeader('X-OTP24-Image-Cache', 'legacy-disabled-no-mongo');
  return res.redirect(302, '/static/logo/icon-logo.png');
});

// GET /apps/api/products?app=&q=
router.get('/apps/api/products', async (req, res) => {
  const q = String(req.query.q || '').trim();
  // `app` may be either the provider category, display platform name, or slug.
  // Do not use it as an exact Mongo filter because provider rows often store
  // generic values such as "account" while the storefront groups by
  // detectPlatform(row) e.g. Facebook/Gmail/Netflix.
  const app = String(req.query.app || '').trim();
  const appNeedle = normKey(app);
  const appSlugNeedle = appSlug(app);
  const cacheKey = `products:${appSlugNeedle || 'all'}:${q || ''}`;
  let payload = memGet(appsProductsCache, cacheKey, 2 * 60 * 1000);
  if (!payload) {
    const filter = { provider: 'otp24', productKind: 'pack' };
    if (q) {
      const safe = escRx(q);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { app: { $regex: safe, $options: 'i' } },
        { category: { $regex: safe, $options: 'i' } },
        { msg: { $regex: safe, $options: 'i' } },
      ];
    }
    const listRaw = await Otp24Product.find(filter, APPS_PRODUCT_PUBLIC_FIELDS).sort({ sold: -1, amount: -1, name: 1 }).lean();
    const list = listRaw.filter(row => !isHiddenPackProduct(row));
    const soldMap = await getSoldMap(list);
    let products = list.map(row => publicProduct(row, soldMap.get(String(row._id))));
    if (app) {
      products = products.filter(p => {
        const hay = normKey([p.platform, p.app, p.providerCategory, p.name, p.slug, p.platformSlug].join(' '));
        return p.platformSlug === appSlugNeedle || p.slug === appSlugNeedle || hay.includes(appNeedle);
      });
    }
    payload = { ok:true, products };
    memSet(appsProductsCache, cacheKey, payload);
  }
  return sendJsonWithEtag(req, res, payload, { privateCache:true, seconds:120 });
});

// POST /apps/buy — ซื้อแอคเคาท์/แอพจาก action=buypack
router.post('/apps/buy', requireAuth, async (req, res) => {
  let stockReserved = false;
  let debited = false;
  let localOrder = null;
  let salePrice = 0;
  let qty = 1;
  let prod = null;
  const userId = req.user?._id;

  try {
    const { productId, quantity } = req.body || {};
    qty = Math.max(1, Math.floor(Number(quantity || 1)));
    if (!productId) return res.status(400).json({ ok:false, error:'กรุณาเลือกสินค้า' });
    if (!userId) return res.status(401).json({ ok:false, error:'กรุณาเข้าสู่ระบบใหม่' });

    prod = await Otp24Product.findOne({ _id: productId, provider:'otp24', productKind:'pack' }, APPS_PRODUCT_PUBLIC_FIELDS).lean();
    if (!prod || isHiddenPackProduct(prod)) return res.status(404).json({ ok:false, error:'ไม่พบสินค้า' });

    const typeCode = prod.typeCode || prod.code || prod.itemId || prod.raw?.type_code;
    if (!typeCode) return res.status(400).json({ ok:false, error:'สินค้านี้ยังไม่มี type_code' });

    const providerUnit = round2(numOrZero(prod.providerPrice ?? prod.basePrice ?? prod.raw?.price ?? 0));
    const saleUnit = round2(providerUnit > 0 ? providerUnit * (1 + MARKUP_PERCENT / 100) : numOrZero(prod.salePrice ?? prod.price ?? 0));
    const providerPrice = round2(providerUnit * qty);
    salePrice = round2(saleUnit * qty);
    const profit = round2(salePrice - providerPrice);

    const soldBefore = (await getSoldMap([prod])).get(String(prod._id)) || 0;
    const stockBefore = applySoldStock(prod, soldBefore);
    const currentStock = stockBefore.amount;
    if (currentStock <= 0) {
      return res.status(400).json({ ok:false, error:'สินค้าหมดแล้ว กรุณาเลือกสินค้าอื่น', productPatch:{ productId:String(prod._id), amount:0, sold:stockBefore.sold, isOutOfStock:true } });
    }
    if (qty > currentStock) {
      return res.status(400).json({ ok:false, error:`สินค้าคงเหลือไม่พอ ตอนนี้เหลือ ${currentStock.toLocaleString('th-TH')} รายการ`, productPatch:{ productId:String(prod._id), amount:currentStock, sold:stockBefore.sold, isOutOfStock:currentStock <= 0 } });
    }

    const debit = await User.updateOne({ _id: userId, balance: { $gte: salePrice } }, { $inc: { balance: -salePrice } });
    if (!debit?.modifiedCount) return res.status(400).json({ ok:false, error:'เครดิตคงเหลือไม่พอ กรุณาเติมเงินก่อนสั่งซื้อ' });
    debited = true;

    const now = new Date();
    const stockResult = await Otp24Product.updateOne(
      { _id: prod._id, provider:'otp24', productKind:'pack', amount: { $gte: qty } },
      { $inc: { amount: -qty }, $set: { lastLocalStockUpdateAt: now } }
    );
    if (!stockResult?.modifiedCount) {
      await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
      debited = false;
      return res.status(400).json({ ok:false, error:'สินค้าหมดสต็อก' });
    }
    stockReserved = true;

    const localOrderId = `local-pack-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    localOrder = await Otp24AppsOrder.create({
      provider:'otp24',
      user:userId,
      productId:prod._id,
      appName:prod.name,
      serviceCode:String(typeCode),
      quantity:qty,
      providerPrice,
      salePrice,
      profit,
      markupPercent:MARKUP_PERCENT,
      orderId:localOrderId,
      status:'processing',
      message:'กำลังสั่งซื้อกับผู้ให้บริการ',
      createdAt:now,
      appsSpentAccounted:0,
    });

    let r;
    try {
      r = await buyPack({ typeCode, amount: qty, timeoutMs: 15000, allowFallback: false });
    } catch (err) {
      r = { ok:false, msg: err?.message || 'provider error', raw: err?.response?.data || null };
    }

    if (!r?.ok) {
      await Promise.allSettled([
        User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }),
        Otp24Product.updateOne({ _id: prod._id }, { $inc: { amount: qty } }),
        Otp24AppsOrder.updateOne({ _id: localOrder._id }, { $set: { status:'failed', message:r?.msg || r?.error || 'สั่งซื้อไม่สำเร็จ', providerRaw:r?.raw ?? r } }),
      ]);
      debited = false;
      stockReserved = false;
      return res.status(502).json({ ok:false, error:r?.msg || r?.error || 'สั่งซื้อไม่สำเร็จ', raw:r?.raw || r?.rawText || null });
    }

    const providerOrderId = r.id || `pack-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    let ord = await Otp24AppsOrder.findByIdAndUpdate(
      localOrder._id,
      {
        $set: {
          orderId:String(providerOrderId),
          status:'success',
          accountText:rewriteOtp24ToolLinks(r.textid || r.msg || '', req),
          linkText:rewriteOtp24ToolLinks(r.linkz || r.linktext || '', req),
          message:'สำเร็จ',
          providerRaw:r.raw ?? r,
          appsSpentAccounted:salePrice,
        }
      },
      { new:true }
    );

    const nextAmount = Math.max(0, currentStock - qty);
    const stockAfter = { amount: nextAmount, sold: Number(soldBefore || 0) + qty, isOutOfStock: nextAmount <= 0 };
    appsSummaryCache.clear();
    appsProductsCache.clear();

    res.json({
      ok:true,
      order:publicOrder(ord.toObject(), req),
      productPatch: { productId:String(prod._id), amount:stockAfter.amount, sold:stockAfter.sold, isOutOfStock:stockAfter.isOutOfStock },
      redirect:'/apps?tab=history',
    });

    setImmediate(async () => {
      try {
        await User.updateOne({ _id: userId }, { $inc: { totalSpentRaw: salePrice }, $set: { lastSpentAt: now } });
        await recalcUserTotals(userId, { force:true, reason:'otp24_apps_success' });
      } catch (e) { glog.warn('[APPS BUY] user spend update failed:', e?.message || e); }
      try { refreshOtp24BalanceAsync?.(); } catch {}
    });
  } catch (e) {
    if (debited && userId && salePrice > 0) await User.updateOne({ _id: userId }, { $inc: { balance: salePrice } }).catch(() => null);
    if (stockReserved && prod?._id && qty > 0) await Otp24Product.updateOne({ _id: prod._id }, { $inc: { amount: qty } }).catch(() => null);
    if (localOrder?._id) await Otp24AppsOrder.updateOne({ _id: localOrder._id }, { $set: { status:'failed', message:e?.message || 'internal error' } }).catch(() => null);
    glog.error('[APPS BUY] unexpected:', e?.message || e);
    res.status(500).json({ ok:false, error:e?.message || 'internal error' });
  }
});

// POST /apps/orders/:orderId/refresh — ดึง logpack จาก provider มาเติมข้อมูลล่าสุด
router.post('/apps/orders/:orderId/refresh', requireAuth, async (req, res) => {
  try {
    const ord = await Otp24AppsOrder.findOne({ orderId:req.params.orderId, user:req.user?._id });
    if (!ord) return res.status(404).json({ ok:false, error:'ไม่พบคำสั่งซื้อ' });
    const result = await refreshOtp24AppsOrderFromProvider(ord);
    const fresh = result?.order || ord;
    res.json({ ok:true, refreshed:!!result?.ok, reason:result?.reason || '', order:publicOrder(fresh.toObject ? fresh.toObject() : fresh, req) });
  } catch (e) {
    res.status(500).json({ ok:false, error:e?.message || 'internal error' });
  }
});

// GET /apps/:slug — หน้าเลือกสินค้าของแอพนั้น เช่น /apps/facebook
router.get('/apps/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const tab = String(req.query.tab || 'shop').toLowerCase() === 'history' ? 'history' : 'shop';
  const q = String(req.query.q || '').trim();
  const apps = await getAppsSummary();
  const selectedApp = apps.find(a => a.slug === slug);

  if (!selectedApp) return res.redirect('/apps');

  // Important: do not filter by `app` exact here. OTP24 pack rows often keep
  // generic provider categories such as "account"/"streaming" in `app`,
  // while the storefront cards are grouped by detectPlatform(row) such as
  // Facebook, Gmail, Netflix, etc. Exact filtering made /apps/facebook show
  // an empty product list even though the summary card counted products.
  const filter = { provider: 'otp24', productKind: 'pack' };
  if (q) {
    const safe = escRx(q);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { app: { $regex: safe, $options: 'i' } },
      { category: { $regex: safe, $options: 'i' } },
      { msg: { $regex: safe, $options: 'i' } },
      { typeCode: { $regex: safe, $options: 'i' } },
    ];
  }

  const productsRawAll = await Otp24Product.find(filter, APPS_PRODUCT_PUBLIC_FIELDS).sort({ sold: -1, amount: -1, salePrice: 1, name: 1 }).lean();
  const productsRaw = productsRawAll.filter(row => !isHiddenPackProduct(row));
  const soldMap = await getSoldMap(productsRaw);
  const products = productsRaw
    .map(row => publicProduct(row, soldMap.get(String(row._id))))
    .filter(p => p.platformSlug === selectedApp.slug || p.slug === selectedApp.slug);
  products.sort((a, b) => Number(a.isOutOfStock) - Number(b.isOutOfStock) || b.sold - a.sold || a.salePrice - b.salePrice || a.name.localeCompare(b.name, 'th'));

  return renderAppsPage(res, {
    mode: 'products',
    apps,
    filteredApps: apps,
    products,
    selectedApp,
    selectedSlug: selectedApp.slug,
    q,
    cat: selectedApp.category || 'all',
    categories: CATEGORY_LABELS,
    tab,
  });
});

export default router;
