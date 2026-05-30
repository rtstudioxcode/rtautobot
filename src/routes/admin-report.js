// src/routes/admin-report.js
import { Router } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import tz from 'dayjs/plugin/timezone.js';
import { Order } from '../models/Order.js';
import { Service } from '../models/Service.js';
import { Otp24Order } from '../models/Otp24Order.js';
import { Otp24AppsOrder } from '../models/Otp24AppsOrder.js';
import { PAID_STATUSES } from '../services/spend.js';
import { config } from '../config.js';

dayjs.extend(utc); dayjs.extend(tz);

const router = Router();

// ───────── GLOBAL LOG ─────────
const isGlobalLogEnabled = () => config?.system?.globalLogEnabled === true;
const glog = {
  log: (...args) => { if (isGlobalLogEnabled()) console.log(...args); },
  info: (...args) => { if (isGlobalLogEnabled()) console.info(...args); },
  warn: (...args) => { if (isGlobalLogEnabled()) console.warn(...args); },
  error: (...args) => { if (isGlobalLogEnabled()) console.error(...args); },
};

// ───────── helpers ─────────
const nz = v => Number.isFinite(+v) ? +v : 0;
const round2 = n => Math.round((nz(n) + Number.EPSILON) * 100) / 100;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const MONTHS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const SERVICE_META = {
  smm:  { key:'smm',  label:'SMM',   title:'Social Marketing', icon:'📣', tone:'gold' },
  otp24:{ key:'otp24',label:'OTP24', title:'OTP Rental',        icon:'🔐', tone:'blue' },
  apps: { key:'apps', label:'Apps',  title:'Premium Apps',      icon:'📱', tone:'green' },
};

const ORDER_EXCLUDE = ['canceled', 'cancelled', 'refunded', 'failed', 'rejected'];
const OTP_SUCCESS = ['success'];
const APPS_SUCCESS = ['success', 'refunded'];
const APPS_DETAIL_STATUSES = ['success', 'refunded'];

function emptyTotals() {
  return { cost: 0, sale: 0, count: 0, profit: 0 };
}

function emptyServiceTotals() {
  return Object.fromEntries(Object.keys(SERVICE_META).map(k => [k, emptyTotals()]));
}

function addToBucket(bucket, cost, sale, count = 1) {
  bucket.cost = round2(nz(bucket.cost) + nz(cost));
  bucket.sale = round2(nz(bucket.sale) + nz(sale));
  bucket.count = nz(bucket.count) + nz(count == null ? 1 : count);
  bucket.profit = round2(bucket.sale - bucket.cost);
}

function addEntry(bucket, serviceBreakdown, serviceKey, cost, sale, count = 1) {
  if (!bucket.services) bucket.services = emptyServiceTotals();
  addToBucket(bucket, cost, sale, count);
  addToBucket(bucket.services[serviceKey], cost, sale, count);
  addToBucket(serviceBreakdown[serviceKey], cost, sale, count);
}

function sumRows(rows = []) {
  const total = emptyTotals();
  for (const r of rows) {
    total.cost = round2(total.cost + nz(r.cost));
    total.sale = round2(total.sale + nz(r.sale));
    total.count += nz(r.count);
  }
  total.profit = round2(total.sale - total.cost);
  return total;
}

function getPartialRefund(o) {
  let sum = 0;
  if (Array.isArray(o.partialRefunds)) {
    for (const r of o.partialRefunds) sum += nz(r?.amount ?? r?.value ?? r?.amt);
  }
  sum += nz(o.partialRefundAmount ?? o.refundedPartial ?? 0);
  if ((o.refundType || '').toLowerCase() === 'full' || (o.status || '').toLowerCase() === 'refunded') {
    return Infinity;
  }
  return round2(sum);
}

function getSaleNetTHB(o) {
  const gross = nz(
    o.cost ?? o.estCost ?? o.total ?? o.amount ?? o.totalPrice ?? o.finalCharge ??
    o.price ?? o.charge ?? o.costTHB ?? 0
  );
  const refunded = getPartialRefund(o);
  if (refunded === Infinity) return 0;
  if (refunded > 0) return Math.max(0, round2(gross - refunded));

  if ((o.status || '').toLowerCase() === 'partial') {
    const qty = nz(o.quantity ?? o.qty);
    const remains = nz(o.remains ?? o.providerResponse?.lastStatus?.remains);
    if (qty > 0 && remains >= 0) return round2(gross * clamp01((qty - remains) / qty));

    const provCharge = nz(o.providerResponse?.lastStatus?.charge) || nz(o.providerResponse?.raw?.charge);
    const rate = nz(o.rateAtOrder ?? o.baseRate ?? o.rawRate ?? o.service?.baseRate ?? o.service?.rate);
    if (provCharge > 0 && rate > 0) {
      const expectedFull = rate * (qty / 1000);
      if (expectedFull > 0) return round2(gross * clamp01(provCharge / expectedFull));
    }
  }
  return round2(gross);
}

function getBaseRate(o, srv) {
  return nz(
    o.baseRate ?? o.rawRate ?? o.rateBeforeRules ??
    srv?.baseRate ?? srv?.origRate ?? srv?.rate ??
    o.rate ?? o.rateAtOrder ?? 0
  );
}

function getProviderCostTHB(o, srv, qty) {
  const fromProvider =
    nz(o.providerResponse?.lastStatus?.charge) ||
    nz(o.providerResponse?.raw?.charge) ||
    nz(o.providerCharge) || nz(o.providerCost);
  if (fromProvider > 0) return round2(fromProvider);

  const baseRate = getBaseRate(o, srv);
  if (baseRate > 0 && qty > 0) return round2(baseRate * (qty / 1000));
  return 0;
}

function getStoredOrderMoney(o = {}) {
  const saleGross = nz(o.salePrice ?? o.amount ?? o.total ?? o.price ?? 0);
  const refund = nz(o.refundAmount ?? 0);
  const sale = Math.max(0, round2(saleGross - refund));
  const cost = sale > 0 ? round2(nz(o.providerPrice ?? o.cost ?? 0)) : 0;
  return { sale, cost, profit: round2(sale - cost), refunded: refund > 0, refundAmount: refund };
}

function appsRefundText(o = {}) {
  return [
    o.accountText,
    o.linkText,
    o.message,
    o.providerRaw?.msg,
    o.providerRaw?.textid,
    o.providerRaw?.linkz,
  ].filter(Boolean).join('\n');
}

function looksLikeAppsRefund(o = {}) {
  if (o.refundApplied === true) return true;
  if (String(o.status || '').toLowerCase() === 'refunded') return true;
  if (nz(o.refundAmount) > 0) return true;
  return /(?:คืน\s*(?:เครดิต|เงิน)|refund(?:ed)?|สินค้ามีปัญหา)/i.test(htmlToPlainText(appsRefundText(o), null));
}

function getAppsOrderMoney(o = {}) {
  const saleGross = round2(nz(o.salePrice ?? o.amount ?? o.total ?? o.price ?? 0));
  const refunded = looksLikeAppsRefund(o);
  const refundAmount = refunded ? round2(nz(o.refundAmount) || saleGross) : 0;

  if (refunded) {
    return { sale: 0, cost: 0, profit: 0, refunded: true, refundAmount };
  }

  const cost = round2(nz(o.providerPrice ?? o.cost ?? 0));
  const sale = saleGross;
  return { sale, cost, profit: round2(sale - cost), refunded: false, refundAmount: 0 };
}

function normalizeRefundDisplayText(text = '', refundAmount = 0) {
  const amount = nz(refundAmount);
  if (!amount) return String(text || '');
  const amountText = amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rx = /((?:^|\n|<br\s*\/?\s*>|&lt;br\s*\/?\s*&gt;)\s*[-–—•]?\s*คืน\s*(?:เครดิต|เงิน)\s*[:：]\s*)(?:฿\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:เครดิต|บาท|THB)?/gi;
  const src = String(text || '');
  if (rx.test(src)) return compactAppsDetailText(src.replace(rx, `$1${amountText} เครดิต`), { removeWaiting:true });
  return compactAppsDetailText(`${src ? `${src}\n` : ''}- คืนเครดิต : ${amountText} เครดิต`, { removeWaiting:true });
}

const APPS_WAITING_DETAIL_LINE_RX = /(?:เจ้าหน้าที่[\s\S]{0,120}กำลัง[\s\S]{0,120}ดำเนินการ[\s\S]{0,120}ส่ง[\s\S]{0,80}ข้อม(?:ู|ู|ลู|ูล)?สินค้า|กรุณาเช็ค[\s\S]{0,120}ประวัติสินค้า[\s\S]{0,80}(?:15\s*นาที|ข้อมูลล่าสุด)|ภายใน\s*24\s*(?:ชม\.?|ชั่วโมง))/i;

function isAppsWaitingDetailLine(line = '') {
  return APPS_WAITING_DETAIL_LINE_RX.test(String(line || ''));
}

function compactAppsDetailText(value = '', opts = {}) {
  const lines = String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&lt;br\s*\/?\s*&gt;/gi, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^\.?\/?logstext\//i.test(line))
    .filter(line => !/\/logstext\/[^\s]+\.txt/i.test(line))
    .filter(line => !opts.removeWaiting || !isAppsWaitingDetailLine(line));
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

function daysOfMonth(start) {
  const days = [];
  const last = start.daysInMonth();
  for (let d = 1; d <= last; d++) days.push(d);
  return days;
}

function toYear(v, fallbackYear) {
  const y = Number(String(v || '').slice(0, 4));
  if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
  return fallbackYear;
}

function safeMonthStr(v, fallbackMonthStr) {
  const s = String(v || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : fallbackMonthStr;
}

function toServiceRows(serviceBreakdown = emptyServiceTotals()) {
  const totalSale = Object.values(serviceBreakdown).reduce((sum, x) => sum + nz(x.sale), 0);
  const totalCount = Object.values(serviceBreakdown).reduce((sum, x) => sum + nz(x.count), 0);
  return Object.entries(SERVICE_META).map(([key, meta]) => {
    const x = serviceBreakdown[key] || emptyTotals();
    return {
      ...meta,
      cost: round2(x.cost),
      sale: round2(x.sale),
      count: nz(x.count),
      profit: round2(x.sale - x.cost),
      salePct: totalSale > 0 ? Math.round((x.sale / totalSale) * 1000) / 10 : 0,
      countPct: totalCount > 0 ? Math.round((x.count / totalCount) * 1000) / 10 : 0,
    };
  });
}

function decodeBasicEntities(v = '') {
  return String(v ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function removeReportNoise(v = '') {
  return String(v ?? '')
    // ซ่อน path ไฟล์ log จาก provider เช่น ./logstext/xxxxx.txt
    .replace(/(?:^|\s)(?:\.\/)?logstext\/[\w./-]+(?:\.txt)?(?=\s|$)/gi, ' ')
    // ซ่อนเส้นคั่นยาว ๆ ที่มากับข้อความ provider
    .replace(/(?:^|\s)[─━═_\-—]{6,}(?=\s|$)/g, ' ');
}

function stripInlineMarkup(v = '') {
  return removeReportNoise(decodeBasicEntities(v))
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*hr[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

function cleanText(v, max = 240) {
  return stripInlineMarkup(v).replace(/\s+/g, ' ').trim().slice(0, max);
}
function publicBaseUrl(req) {
  const proto = String(req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http').split(',')[0].trim();
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function safePathPart(v) {
  try { return encodeURIComponent(decodeURIComponent(String(v || '').trim())); }
  catch { return encodeURIComponent(String(v || '').trim()); }
}

function rewriteToolLinks(text = '', req) {
  const base = publicBaseUrl(req);
  if (!base) return String(text || '');
  return String(text || '')
    .replace(/https?:\/\/[^\s<>'"|]+\/mailz\/([^\s<>'"|]+)/gi, (_, mail) => `${base}/mailz/${safePathPart(mail)}`)
    .replace(/https?:\/\/[^\s<>'"|]+\/mails\b/gi, `${base}/mails`)
    .replace(/https?:\/\/[^\s<>'"|]+\/2fa\/([^\s<>'"|]+)/gi, (_, g) => `${base}/2fa/${safePathPart(g)}`);
}

function htmlToPlainText(v = '', req) {
  return rewriteToolLinks(v, req)
    .replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '\n')
    .replace(/&lt;\s*hr[^&]*&gt;/gi, '\n')
    .replace(/&lt;[^&]*&gt;/g, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*hr[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|tr)>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/(?:^|\n)\s*(?:\.\/)?logstext\/[\w./-]+(?:\.txt)?\s*(?=\n|$)/gi, '\n')
    .replace(/(?:^|\n)\s*[─━═_\-—]{6,}\s*(?=\n|$)/g, '\n')
    .replace(/(?:^|\s)(?:\.\/)?logstext\/[\w./-]+(?:\.txt)?(?=\s|$)/gi, ' ')
    .replace(/(?:^|\s)[─━═_\-—]{6,}(?=\s|$)/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanDetailText(v, req, max = 420) {
  return htmlToPlainText(v, req).replace(/\s*\|\s*/g, '\n').trim().slice(0, max) || '-';
}

function detailRows(v, req) {
  const plain = compactAppsDetailText(cleanDetailText(v, req, 1800));
  if (!plain || plain === '-') return [];
  const seen = new Set();
  return plain
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      const key = line
        .replace(/\s+/g, ' ')
        .replace(/(?:คืน\s*(?:เครดิต|เงิน)\s*[:：]\s*)(?:฿\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:เครดิต|บาท|THB)?/i, 'คืนเครดิต:AMOUNT')
        .toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(line => {
      const m = line.match(/^([^:：]{1,34})\s*[:：]\s*(.+)$/);
      return m ? { key: m[1].trim(), value: m[2].trim() } : { key: '', value: line };
    });
}

function customerInfo(u) {
  if (!u) return { name: 'ไม่พบผู้ใช้', sub: '-' };
  const name = cleanText(u.name || u.username || u.email || 'ไม่ระบุชื่อ', 80) || 'ไม่ระบุชื่อ';
  const sub = cleanText([u.username, u.email].filter(Boolean).join(' • '), 120) || '-';
  return { name, sub };
}

function dateTH(d, tzName) {
  const x = dayjs(d).tz(tzName);
  return x.isValid() ? x.format('DD/MM/YYYY HH:mm') : '-';
}

function shortId(v) {
  const s = cleanText(v, 80);
  return s ? s : '-';
}

function pickServiceName(o = {}) {
  return cleanText(
    o.service?.name || o.serviceName || o.appName || o.productName || o.providerServiceId || o.serviceCode || '-',
    180
  ) || '-';
}

function firstText(...values) {
  for (const v of values) {
    const s = cleanText(v, 900);
    if (s && s !== '-') return s;
  }
  return '';
}

function buildSmmDetail(o = {}) {
  const rawProvider = o.providerResponse?.lastStatus || o.providerResponse?.raw || {};
  const main = firstText(
    o.link,
    o.target,
    o.url,
    o.postUrl,
    o.profileUrl,
    o.channelUrl,
    o.videoUrl,
    o.comments,
    o.comment,
    o.keywords,
    o.customComments,
    rawProvider.link,
    rawProvider.target,
    rawProvider.url,
    o.providerResponse?.message,
    o.providerResponse?.msg
  );
  return main || '-';
}

function buildOtp24Detail(o = {}) {
  const rawProvider = o.providerRaw || o.raw || o.providerResponse || {};
  const parts = [
    o.phone || o.number || o.mobile || o.tel,
    o.otp || o.code || o.smsCode,
  ].filter(Boolean);
  const joined = cleanText(parts.join(' • '), 240);
  if (joined) return joined;

  return firstText(
    o.message,
    o.sms,
    o.smsText,
    o.text,
    o.providerMessage,
    rawProvider.msg,
    rawProvider.message,
    rawProvider.sms,
    rawProvider.text,
    rawProvider.otp
  ) || '-';
}

async function collectOrderDetails({ start, end, tzName, req }) {
  const [smmRows, otpRows, appRows] = await Promise.all([
    Order.find({
      createdAt: { $gte: start.toDate(), $lt: end.toDate() },
      status: { $in: PAID_STATUSES, $nin: ORDER_EXCLUDE }
    })
      .select('_id userId user service serviceName appName productName providerServiceId serviceCode providerOrderId quantity qty link target url postUrl profileUrl channelUrl videoUrl comments comment keywords customComments cost estCost charged refundAmount partialRefunds status createdAt rateAtOrder baseRate rawRate rateBeforeRules remains providerResponse.message providerResponse.msg providerResponse.lastStatus.charge providerResponse.lastStatus.remains providerResponse.lastStatus.link providerResponse.lastStatus.target providerResponse.lastStatus.url providerResponse.raw.charge providerResponse.raw.remains providerResponse.raw.link providerResponse.raw.target providerResponse.raw.url')
      .populate({ path: 'userId', select: 'username email name' })
      .populate({ path: 'user', select: 'username email name' })
      .populate({ path: 'service', model: Service, select: 'name baseRate base_rate rate type min max average_delivery' })
      .sort({ createdAt: -1 })
      .limit(700)
      .lean(),

    Otp24Order.find({
      createdAt: { $gte: start.toDate(), $lt: end.toDate() },
      status: { $in: OTP_SUCCESS },
      $or: [
        { productKind: { $exists: false } },
        { productKind: 'otp' },
        { productKind: null },
      ],
    })
      .select('_id user appName productName serviceCode serviceName countryId orderId providerPrice salePrice status createdAt refundAmount phone number mobile tel otp code smsCode message sms smsText text providerMessage providerRaw.msg providerRaw.message providerRaw.sms providerRaw.text providerRaw.otp raw.msg raw.message raw.sms raw.text raw.otp providerResponse.msg providerResponse.message providerResponse.sms providerResponse.text providerResponse.otp')
      .populate({ path: 'user', select: 'username email name' })
      .sort({ createdAt: -1 })
      .limit(700)
      .lean(),

    Otp24AppsOrder.find({
      createdAt: { $gte: start.toDate(), $lt: end.toDate() },
      status: { $in: APPS_DETAIL_STATUSES },
    })
      .select('_id user appName serviceCode providerPrice salePrice status accountText linkText message providerRaw.msg providerRaw.textid providerRaw.linkz refundApplied refundAmount refundNote createdAt')
      .populate({ path: 'user', select: 'username email name' })
      .sort({ createdAt: -1 })
      .limit(700)
      .lean(),
  ]);

  const smm = smmRows.map(o => {
    const u = customerInfo(o.userId || o.user);
    const qty = nz(o.quantity ?? o.qty);
    const sale = getSaleNetTHB(o);
    const cost = getProviderCostTHB(o, o.service, qty);
    return {
      type: 'smm',
      at: dateTH(o.createdAt, tzName),
      customer: u.name,
      customerSub: u.sub,
      title: pickServiceName(o),
      detail: cleanText(buildSmmDetail(o), 520),
      qty,
      sale,
      cost,
      profit: round2(sale - cost),
      status: cleanText(o.status || '-'),
      orderId: shortId(o.providerOrderId || o._id),
      extra: cleanText(`Service ID: ${o.providerServiceId || '-'}${o.remains != null ? ` • Remains: ${o.remains}` : ''}`, 220),
    };
  });

  const otp24 = otpRows.map(o => {
    const u = customerInfo(o.user);
    const { sale, cost } = getStoredOrderMoney(o);
    const target = cleanText(buildOtp24Detail(o), 520);
    return {
      type: 'otp24',
      at: dateTH(o.createdAt, tzName),
      customer: u.name,
      customerSub: u.sub,
      title: cleanText(o.appName || o.serviceCode || 'OTP24', 160),
      detail: target || '-',
      qty: nz(o.quantity || 1),
      sale,
      cost,
      profit: round2(sale - cost),
      status: cleanText(o.status || '-'),
      orderId: shortId(o.orderId || o._id),
      extra: cleanText(`ประเทศ: ${o.countryId ?? '-'} • Code: ${o.serviceCode || '-'}`, 220),
    };
  });

  const apps = appRows.map(o => {
    const u = customerInfo(o.user);
    const money = getAppsOrderMoney(o);
    const primaryDetail = o.accountText || o.providerRaw?.msg || o.providerRaw?.textid || o.message || o.linkText || '-';
    const rawDetailOriginal = compactAppsDetailText(primaryDetail, { removeWaiting:money.refunded });
    const rawDetail = money.refunded ? normalizeRefundDisplayText(rawDetailOriginal || '-', money.refundAmount) : rawDetailOriginal;
    const detail = cleanDetailText(rawDetail || '-', req, 520);
    return {
      type: 'apps',
      at: dateTH(o.createdAt, tzName),
      customer: u.name,
      customerSub: u.sub,
      title: cleanText(o.appName || o.serviceCode || 'Premium Apps', 170),
      detail,
      detailRows: detailRows(rawDetail || '-', req),
      qty: nz(o.quantity || 1),
      sale: money.sale,
      cost: money.cost,
      profit: money.profit,
      status: money.refunded ? 'refunded' : cleanText(o.status || '-'),
      refundApplied: money.refunded,
      refundAmount: money.refundAmount,
      refundedAt: o.refundedAt || null,
      orderId: shortId(o.orderId || o._id),
      extra: cleanText(`Code: ${o.serviceCode || '-'} • Markup: ${nz(o.markupPercent)}%${money.refunded ? ` • คืนเครดิต: ฿${money.refundAmount.toFixed(2)}` : ''}`, 260),
    };
  });

  return { smm, otp24, apps, all: [...smm, ...otp24, ...apps].sort((a,b) => String(b.at).localeCompare(String(a.at))) };
}

async function collectSummary({ start, end, bucketForDate, initBuckets, tzName }) {
  const buckets = initBuckets();
  const serviceBreakdown = emptyServiceTotals();

  const [orders, otpOrders, appsOrders] = await Promise.all([
    Order.find({
      createdAt: { $gte: start.toDate(), $lt: end.toDate() },
      status: { $in: PAID_STATUSES, $nin: ORDER_EXCLUDE }
    }).select('_id service quantity qty cost estCost charged refundAmount partialRefunds status createdAt rateAtOrder baseRate rawRate providerResponse.lastStatus.charge providerResponse.raw.charge').populate({ path: 'service', model: Service, select: 'baseRate rate name' }).lean(),

    Otp24Order.find({
      createdAt: { $gte: start.toDate(), $lt: end.toDate() },
      status: { $in: OTP_SUCCESS },
      $or: [
        { productKind: { $exists: false } },
        { productKind: 'otp' },
        { productKind: null },
      ],
    }).select('_id providerPrice salePrice refundAmount status createdAt').lean(),

    Otp24AppsOrder.find({
      createdAt: { $gte: start.toDate(), $lt: end.toDate() },
      status: { $in: APPS_SUCCESS },
    }).select('_id providerPrice salePrice refundAmount refundApplied status accountText linkText message providerRaw.msg providerRaw.textid providerRaw.linkz createdAt').lean(),
  ]);

  for (const o of orders) {
    const key = bucketForDate(dayjs(o.createdAt).tz(tzName));
    const qty = nz(o.quantity ?? o.qty);
    addEntry(buckets[key], serviceBreakdown, 'smm', getProviderCostTHB(o, o.service, qty), getSaleNetTHB(o));
  }

  for (const o of otpOrders) {
    const key = bucketForDate(dayjs(o.createdAt).tz(tzName));
    const m = getStoredOrderMoney(o);
    addEntry(buckets[key], serviceBreakdown, 'otp24', m.cost, m.sale);
  }

  for (const o of appsOrders) {
    const key = bucketForDate(dayjs(o.createdAt).tz(tzName));
    const m = getAppsOrderMoney(o);
    // รายการที่คืนเครดิตแล้วไม่ถือเป็นยอดขาย/ต้นทุน/กำไร/รายการสำเร็จในสรุปยอด
    addEntry(buckets[key], serviceBreakdown, 'apps', m.cost, m.sale, m.refunded ? 0 : 1);
  }

  return { buckets, serviceBreakdown, serviceRows: toServiceRows(serviceBreakdown) };
}

// ───────── route ─────────
router.get('/admin/report/summary', async (req, res) => {
  try {
    const tzName = req.app?.locals?.timezone || 'Asia/Bangkok';
    const nowBkk = dayjs().tz(tzName);
    const reportMode = String(req.query.mode || '').toLowerCase() === 'year' ? 'year' : 'month';
    const fallbackMonthStr = nowBkk.format('YYYY-MM');
    const yearStr = String(toYear(req.query.year, nowBkk.year()));
    const monthStr = safeMonthStr(req.query.month, fallbackMonthStr);

    if (reportMode === 'year') {
      const yy = Number(yearStr);
      const start = dayjs.tz(`${yy}-01-01T00:00:00`, tzName);
      const end = start.add(1, 'year');
      const { buckets, serviceRows } = await collectSummary({
        start, end, tzName,
        bucketForDate: (d) => d.month() + 1,
        initBuckets: () => {
          const x = {};
          for (let m = 1; m <= 12; m++) x[m] = { ...emptyTotals(), services: emptyServiceTotals() };
          return x;
        },
      });

      const orderDetails = await collectOrderDetails({ start, end, tzName, req });

      const rows = Array.from({ length: 12 }, (_, idx) => {
        const monthNo = idx + 1;
        const x = buckets[monthNo] || emptyTotals();
        return {
          monthNo,
          month: monthNo,
          monthStr: `${yy}-${String(monthNo).padStart(2, '0')}`,
          monthLabel: MONTHS_TH[idx],
          cost: round2(x.cost),
          sale: round2(x.sale),
          count: nz(x.count),
          profit: round2(x.sale - x.cost),
          services: x.services || emptyServiceTotals(),
        };
      });

      return res.render('admin/reportsummary', {
        title: 'สรุปยอดขายรายปี',
        reportMode,
        yearStr,
        monthStr,
        rows,
        monthTotals: sumRows(rows),
        serviceBreakdown: serviceRows,
        serviceSummary: serviceRows,
        orderDetails,
      });
    }

    const start = dayjs.tz(`${monthStr}-01T00:00:00`, tzName);
    const end = start.add(1, 'month');
    const { buckets, serviceRows } = await collectSummary({
      start, end, tzName,
      bucketForDate: (d) => d.date(),
      initBuckets: () => {
        const x = {};
        for (const d of daysOfMonth(start)) x[d] = { ...emptyTotals(), services: emptyServiceTotals() };
        return x;
      },
    });

    const orderDetails = await collectOrderDetails({ start, end, tzName, req });

    const rows = daysOfMonth(start).map(d => {
      const x = buckets[d] || emptyTotals();
      return {
        day: d,
        cost: round2(x.cost),
        sale: round2(x.sale),
        count: nz(x.count),
        profit: round2(x.sale - x.cost),
        services: x.services || emptyServiceTotals(),
      };
    });

    res.render('admin/reportsummary', {
      title: 'สรุปยอดขายรายเดือน',
      reportMode,
      yearStr: String(start.year()),
      monthStr,
      rows,
      monthTotals: sumRows(rows),
      serviceBreakdown: serviceRows,
      serviceSummary: serviceRows,
      orderDetails,
    });
  } catch (e) {
    glog.error('[admin-report] summary failed:', e);
    res.status(500).send('Report failed: ' + e.message);
  }
});

export default router;
