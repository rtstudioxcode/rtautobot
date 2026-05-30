// src/services/otp24AppsOrderRefresh.js
import { Otp24AppsOrder } from '../models/Otp24AppsOrder.js';
import { User } from '../models/User.js';
import { getPackLogs } from '../lib/otp24Adapter.js';
import { config } from '../config.js';
import { recalcUserTotals } from './spend.js';

const DEFAULT_BATCH_LIMIT = 50;

// Apps/getpack ของ OTP24 จะคืน status=success ตั้งแต่ตอนซื้อ แม้รายละเอียดสินค้ายังไม่พร้อม
// ดังนั้น job ต้องยึด 'ข้อความรอเจ้าหน้าที่' ใน accountText/linkText/message เป็นตัวตัดสิน ไม่ใช่ status
export const WAITING_PACK_DETAIL_RX = /(?:เจ้าหน้าที่[\s\S]{0,120}กำลัง[\s\S]{0,120}ดำเนินการ[\s\S]{0,120}ส่ง[\s\S]{0,80}ข้อม(?:ู|ู|ลู|ูล)?สินค้า|กรุณาเช็ค[\s\S]{0,120}ประวัติสินค้า[\s\S]{0,60}15\s*นาที|ภายใน\s*24\s*(?:ชม\.?|ชั่วโมง))/i;

export const PENDING_PACK_DETAIL_TEXT = [
  'เจ้าหน้าที่กำลังดำเนินการส่งข้อมูลสินค้า (ภายใน 24 ชม.)',
  'กรุณาเช็ค "ประวัติสินค้า" ทุก 15 นาที เพื่อรับข้อมูลล่าสุด',
].join('\n');

function isGlobalLogEnabled() {
  return config?.system?.globalLogEnabled === true;
}

function log(...args) {
  if (isGlobalLogEnabled()) console.log('[OTP24_APPS_REFRESH]', ...args);
}

function warn(...args) {
  if (isGlobalLogEnabled()) console.warn('[OTP24_APPS_REFRESH]', ...args);
}

export function htmlToPlainText(value = '') {
  return String(value || '')
    .replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '\n')
    .replace(/&lt;\s*hr[^&]*&gt;/gi, '\n')
    .replace(/&lt;[^&]*&gt;/g, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*hr[^>]*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
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

export function stripOtp24SupportLines(value = '') {
  const raw = htmlToPlainText(value);
  if (!raw) return '';

  return raw
    .replace(/\s*\|\s*/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      // ซ่อนบรรทัดแนว “เพื่อความรวดเร็ว / ติดต่อสอบถาม Facebook” โดยไม่ไปลบคำว่า Facebook ที่เป็นข้อมูลจริง
      if (/เพื่อความรวดเร็ว/i.test(line) && /ติดต่อสอบถาม/i.test(line)) return false;
      if (/ติดต่อสอบถาม/i.test(line) && /facebook|เฟซบุ๊ก|เฟสบุ๊ค|fb\b/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

export function isPendingPackDetail(value = '') {
  const text = htmlToPlainText(value)
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return false;

  const hasStaffPending = /เจ้าหน้าที่[\s\S]{0,120}กำลัง[\s\S]{0,120}ดำเนินการ[\s\S]{0,120}ส่ง[\s\S]{0,80}ข้อม(?:ู|ู|ลู|ูล)?สินค้า/i.test(text);
  const hasHistoryHint = /กรุณาเช็ค[\s\S]{0,120}ประวัติสินค้า[\s\S]{0,60}15\s*นาที/i.test(text);
  const has24h = /ภายใน\s*24\s*(?:ชม\.?|ชั่วโมง)/i.test(text);

  return hasHistoryHint || (hasStaffPending && has24h) || WAITING_PACK_DETAIL_RX.test(text);
}

export function isOrderWaitingForPackDetail(order = {}) {
  return [order.accountText, order.linkText, order.message].some(isPendingPackDetail);
}


// ข้อความคืนเครดิตจาก OTP24/getpack: ต้นทางอาจส่งยอดต้นทุน เช่น 5.00
// แต่ฝั่งเราเก็บ/คืนเป็นราคาขายจริงที่ลูกค้าจ่าย เช่น 6.75 เพื่อไม่ให้ UI และยอดเงินสับสน
export const PACK_REFUND_RX = /(?:คืน\s*(?:เครดิต|เงิน)|refund(?:ed)?|สินค้ามีปัญหา)/i;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function saleRefundAmount(order = {}) {
  const sale = round2(order.salePrice || order.amount || order.price || 0);
  return sale > 0 ? sale : 0;
}

function hasPackRefundSignal(...values) {
  const text = values.map(v => htmlToPlainText(v || '')).filter(Boolean).join('\n');
  return PACK_REFUND_RX.test(text);
}

function compactPackDetailText(value = '') {
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

function compactPackLinkText(value = '') {
  const seen = new Set();
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/&lt;br\s*\/?\s*&gt;/gi, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n')
    .trim();
}

function normalizeRefundCreditText(value = '', refundAmount = 0) {
  const amountText = Number(refundAmount || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let text = compactPackDetailText(value || '');

  // เปลี่ยนเฉพาะบรรทัดยอดคืนเครดิต/คืนเงิน ไม่แตะบรรทัดวันที่ เช่น "คืนเครดิตแล้ว : (2026-05-14)"
  const amountLineRx = /((?:^|\n)\s*[-–—•]?\s*คืน\s*(?:เครดิต|เงิน)\s*[:：]\s*)(?:฿\s*)?[0-9][0-9,]*(?:\.\d+)?\s*(?:เครดิต|บาท|THB)?/gi;
  if (amountLineRx.test(text)) {
    return compactPackDetailText(text.replace(amountLineRx, `$1${amountText} เครดิต`));
  }

  if (!/คืน\s*(?:เครดิต|เงิน)\s*[:：]/i.test(text)) {
    text = `${text ? `${text}\n` : ''}- คืนเครดิต : ${amountText} เครดิต`;
  }
  return compactPackDetailText(text);
}

async function applyAppsPackRefund(order = {}, match = {}, now = new Date()) {
  if (!order?._id) return { ok:false, reason:'missing_order' };

  const refundAmount = saleRefundAmount(order);
  if (refundAmount <= 0) {
    await Otp24AppsOrder.updateOne(
      { _id: order._id },
      { $set: { providerRaw: match || order.providerRaw || {}, appsAutoRefreshLastAt: now, appsAutoRefreshLastResult: 'refund_detected_missing_amount' }, $inc: { appsAutoRefreshCount: 1 } }
    ).catch(() => null);
    return { ok:false, reason:'refund_amount_zero' };
  }

  // ใช้ข้อมูลสดจาก provider ก่อน แล้วค่อย fallback DB เดิม พร้อม dedupe กันข้อความซ้ำจาก refresh หลายรอบ
  const rawText = [pickPackLogText(match), match?.msg, match?.textid, order.accountText].filter(Boolean).join('\n') || order.accountText || '';
  const rawLink = [pickPackLogLink(match), match?.linktext, match?.linkz, order.linkText].filter(Boolean).join('\n') || order.linkText || '';
  const accountText = normalizeRefundCreditText(rawText, refundAmount);
  const linkText = compactPackLinkText(stripOtp24SupportLines(rawLink || ''));
  const note = `คืนเครดิต Apps/getpack อัตโนมัติเต็มยอดขาย ${refundAmount.toFixed(2)} เครดิต`;

  const upd = await Otp24AppsOrder.updateOne(
    { _id: order._id, refundApplied: { $ne: true } },
    {
      $set: {
        providerRaw: match || order.providerRaw || {},
        accountText,
        linkText,
        status: 'refunded',
        message: 'คืนเงินแล้ว',
        refundApplied: true,
        refundAmount,
        refundedAt: now,
        refundNote: note,
        appsSpentAccounted: 0,
        appsSpentAccountedAt: now,
        appsAutoRefreshLastAt: now,
        appsAutoRefreshLastResult: 'refunded',
      },
      $inc: { appsAutoRefreshCount: 1 },
    }
  );

  if (upd.modifiedCount !== 1) {
    // คืนเงินไปแล้ว: ห้ามบวกเงินซ้ำ แต่ cleanup ข้อความซ้ำ/ยอดแสดงผลให้สะอาด
    await Otp24AppsOrder.updateOne(
      { _id: order._id, refundApplied: true },
      {
        $set: {
          providerRaw: match || order.providerRaw || {},
          accountText,
          linkText,
          status: 'refunded',
          message: 'คืนเงินแล้ว',
          refundAmount: Number(order.refundAmount || refundAmount),
          appsSpentAccounted: 0,
          appsSpentAccountedAt: now,
          appsAutoRefreshLastAt: now,
          appsAutoRefreshLastResult: 'already_refunded_cleaned',
        },
        $inc: { appsAutoRefreshCount: 1 },
      }
    ).catch(() => null);
    const fresh = await Otp24AppsOrder.findById(order._id).lean().catch(() => null);
    return { ok:true, changed:false, refunded:false, alreadyRefunded:true, order:fresh, match };
  }

  if (order.user) {
    try {
      await User.updateOne({ _id: order.user }, { $inc: { balance: refundAmount } });
      await recalcUserTotals(order.user, { force:true, reason:'otp24_apps_refund' }).catch(() => null);
    } catch (e) {
      warn('wallet refund failed:', { orderId: order.orderId, amount: refundAmount, error:e?.message || e });
    }
  }

  const fresh = await Otp24AppsOrder.findById(order._id).lean().catch(() => null);
  return { ok:true, changed:true, refunded:true, refundAmount, order:fresh, match };
}

function packLogIds(item = {}) {
  const raw = item?.raw && typeof item.raw === 'object' ? item.raw : {};
  return [
    item.id,
    item.order,
    item.order_id,
    item.orderid,
    item.order_no,
    item.orderNo,
    item.ref,
    item.ref_id,
    item.transaction_id,
    item.transactionId,
    item.buy_id,
    item.buyId,
    item.pack_id,
    item.packId,
    item.log_id,
    item.logId,
    raw.id,
    raw.order,
    raw.order_id,
    raw.orderid,
    raw.order_no,
    raw.transaction_id,
    raw.buy_id,
    raw.pack_id,
  ].map(v => String(v ?? '').trim()).filter(Boolean);
}

function escapeRx(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function objectContainsOrderId(item = {}, orderId = '') {
  const oid = String(orderId || '').trim();
  if (!oid) return false;
  const rx = new RegExp(`(?:^|[^0-9])${escapeRx(oid)}(?:[^0-9]|$)`);
  try {
    return rx.test(JSON.stringify(item || {}));
  } catch {
    return false;
  }
}

function pickPackLogText(item = {}) {
  return stripOtp24SupportLines(item.msg || item.textid || item.text_id || item.text || item.detail || '');
}

function pickPackLogLink(item = {}) {
  return stripOtp24SupportLines(item.linktext || item.linkz || item.link || item.url || '');
}

function packLogHasRealDetail(item = {}) {
  const detail = [pickPackLogText(item), pickPackLogLink(item), item.message].filter(Boolean).join('\n');
  if (!detail.trim()) return false;
  return !isPendingPackDetail(detail);
}

function matchPackLogForOrder(order = {}, items = []) {
  const oid = String(order.orderId || '').trim();
  if (!oid) return null;

  // ชั้นแรก: match จาก key ปกติของ logpack
  const direct = (items || []).find(item => packLogIds(item).includes(oid));
  if (direct) return direct;

  // ชั้นสอง: fallback ค้นเลข order ใน raw JSON ทั้งก้อน
  // OTP24 บางครั้งเปลี่ยนชื่อ key เช่น orderid / buy_id / transaction_id
  return (items || []).find(item => objectContainsOrderId(item, oid)) || null;
}

async function applyPackLogToOrder(order, match, now = new Date()) {
  if (!order?._id || !match) return { ok:false, reason:'missing_order_or_match' };

  if (hasPackRefundSignal(pickPackLogText(match), pickPackLogLink(match), match?.msg, match?.textid, match?.message, order.accountText, order.linkText, order.message)) {
    return applyAppsPackRefund(order, match, now);
  }

  if (!packLogHasRealDetail(match)) {
    await Otp24AppsOrder.updateOne(
      { _id: order._id },
      { $set: { providerRaw: match, appsAutoRefreshLastAt: now, appsAutoRefreshLastResult: 'still_pending' }, $inc: { appsAutoRefreshCount: 1 } }
    ).catch(() => null);
    return { ok:false, reason:'still_pending' };
  }

  const patch = {
    providerRaw: match,
    accountText: pickPackLogText(match) || stripOtp24SupportLines(order.accountText || ''),
    linkText: pickPackLogLink(match) || stripOtp24SupportLines(order.linkText || ''),
    status: 'success',
    message: 'สำเร็จ',
    appsAutoRefreshLastAt: now,
    appsAutoRefreshLastResult: 'updated',
  };

  await Otp24AppsOrder.updateOne({ _id: order._id }, { $set: patch, $inc: { appsAutoRefreshCount: 1 } });
  const fresh = await Otp24AppsOrder.findById(order._id).lean();
  return { ok:true, order:fresh, match };
}

export async function refreshOtp24AppsOrdersFromProvider(orders = []) {
  const targets = (Array.isArray(orders) ? orders : []).filter(o => o?._id);
  if (!targets.length) return { ok:true, checked:0, updated:0, missed:0, stillPending:0, orders:[] };

  const provider = await getPackLogs().catch(e => ({ ok:false, error:e?.message || String(e), items:[] }));
  if (!provider?.ok || !Array.isArray(provider.items)) {
    warn('provider failed:', provider?.error || 'logpack failed');
    await Otp24AppsOrder.updateMany(
      { _id: { $in: targets.map(o => o._id) } },
      { $set: { appsAutoRefreshLastAt: new Date(), appsAutoRefreshLastResult: 'provider_failed' }, $inc: { appsAutoRefreshCount: 1 } }
    ).catch(() => null);
    return { ok:false, checked:targets.length, updated:0, missed:targets.length, stillPending:0, error:provider?.error || 'logpack failed', orders:[] };
  }

  let updated = 0;
  let missed = 0;
  let stillPending = 0;
  let refunded = 0;
  const freshOrders = [];
  const now = new Date();

  for (const order of targets) {
    const match = matchPackLogForOrder(order, provider.items);
    if (!match) {
      missed += 1;
      await Otp24AppsOrder.updateOne(
        { _id: order._id },
        { $set: { appsAutoRefreshLastAt: now, appsAutoRefreshLastResult: 'not_found' }, $inc: { appsAutoRefreshCount: 1 } }
      ).catch(() => null);
      continue;
    }

    const result = await applyPackLogToOrder(order, match, now);
    if (result?.ok) {
      if (result.refunded) refunded += 1;
      else if (result.changed === false && result.alreadyRefunded) refunded += 0;
      else updated += 1;
      if (result.order) freshOrders.push(result.order);
    } else if (result?.reason === 'still_pending') {
      stillPending += 1;
    } else {
      missed += 1;
    }
  }

  log('done', { checked:targets.length, updated, refunded, missed, stillPending });
  return { ok:true, checked:targets.length, updated, refunded, missed, stillPending, orders:freshOrders };
}

export async function refreshOtp24AppsOrderFromProvider(order) {
  if (!order?._id) return { ok:false, reason:'missing_order' };

  const provider = await getPackLogs().catch(e => ({ ok:false, error:e?.message || String(e), items:[] }));
  if (!provider?.ok || !Array.isArray(provider.items)) {
    return { ok:false, reason:'provider_failed', error:provider?.error || 'logpack failed' };
  }

  const match = matchPackLogForOrder(order, provider.items);
  if (!match) return { ok:false, reason:'not_found' };
  return applyPackLogToOrder(order, match, new Date());
}

export async function runOtp24AppsOrderRefreshOnce(options = {}) {
  const limit = Math.max(1, Math.min(300, Number(options.limit || config?.jobs?.otp24AppsRefreshBatchLimit || DEFAULT_BATCH_LIMIT)));

  // สำคัญ: ห้ามหา status=pending เพราะ buypack จะบันทึก status=success ตั้งแต่แรก
  // เราเช็คเฉพาะรายการที่ยังมีข้อความรอเจ้าหน้าที่ในรายละเอียดสินค้าแทน
  const rows = await Otp24AppsOrder.find({
    provider: 'otp24',
    refundApplied: { $ne: true },
    $or: [
      { accountText: WAITING_PACK_DETAIL_RX },
      { linkText: WAITING_PACK_DETAIL_RX },
      { message: WAITING_PACK_DETAIL_RX },
      { 'providerRaw.textid': WAITING_PACK_DETAIL_RX },
      { 'providerRaw.linkz': WAITING_PACK_DETAIL_RX },
      { accountText: PACK_REFUND_RX },
      { linkText: PACK_REFUND_RX },
      { message: PACK_REFUND_RX },
      { 'providerRaw.msg': PACK_REFUND_RX },
      { 'providerRaw.textid': PACK_REFUND_RX },
      { 'providerRaw.linkz': PACK_REFUND_RX },
    ],
  })
    .sort({ appsAutoRefreshLastAt: 1, updatedAt: 1, createdAt: 1 })
    .limit(limit)
    .lean();

  const pendingOrders = rows.filter(o => isOrderWaitingForPackDetail(o) || hasPackRefundSignal(o.accountText, o.linkText, o.message, o.providerRaw?.msg, o.providerRaw?.textid, o.providerRaw?.linkz));
  if (!pendingOrders.length) {
    log('no waiting accountText apps orders');
    return { ok:true, checked:0, updated:0, missed:0, stillPending:0 };
  }

  log('waiting accountText apps orders found', { count: pendingOrders.length, limit, statusIgnored:true });
  return refreshOtp24AppsOrdersFromProvider(pendingOrders);
}
