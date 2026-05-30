// src/jobs/orderStatusJob.js
import os from 'os';
import pLimit from 'p-limit';
import { Order } from '../models/Order.js';
import { getOrderStatus, cancelOrder } from '../lib/iplusviewAdapter.js';
import { config, connectMongoIfNeeded } from '../config.js';
import { reconcileUserByOrderEvent, recalcUserTotals } from '../services/spend.js';
import { log, warn, errlog } from '../utils/logger.js';

function safeNumber(value, fallback, min = 1) {
  const n = Number(value);
  return Math.max(min, Number.isFinite(n) ? n : fallback);
}

function getTickMs() {
  return safeNumber(config?.jobs?.orderStatusTickMs, 60_000, 5_000);
}

function getConcurrency() {
  return safeNumber(config?.jobs?.orderStatusConcurrency, 20, 1);
}

function getBatchLimit() {
  return safeNumber(config?.jobs?.orderStatusBatchLimit, 300, 1);
}

function getFastScanMs() {
  return safeNumber(config?.jobs?.orderStatusFastScanMs, 2_000, 1_000);
}

function getAutoCancelAfterMs() {
  return safeNumber(
    config?.jobs?.orderStatusAutoCancelAfterMs,
    12 * 60 * 60 * 1000,
    60_000
  );
}

function getRecentCheckMs() {
  return safeNumber(config?.jobs?.orderStatusRecentCheckMs, 60_000, 30_000);
}

function getWarmCheckMs() {
  return safeNumber(config?.jobs?.orderStatusWarmCheckMs, 5 * 60_000, 60_000);
}

function getColdCheckMs() {
  return safeNumber(config?.jobs?.orderStatusColdCheckMs, 15 * 60_000, 60_000);
}

function getTerminalCleanupCheckMs() {
  return safeNumber(config?.jobs?.orderStatusTerminalCleanupCheckMs, 30 * 60_000, 60_000);
}

function getInstanceId() {
  return `${os.hostname()}:${process.pid}`;
}

const AUTO_CANCEL_PENDING = 'auto-system:pending';
const AUTO_CANCEL_FALLBACK = 'auto-system';

let mainTimer = null;
let fastTimer = null;
let tickRunning = false;
let fastRunnerRunning = false;
let started = false;

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isModified(res) {
  return Boolean(res?.modifiedCount || res?.nModified || res?.upsertedCount);
}

function mapProviderStatus(s) {
  const x = String(s || '').trim().toLowerCase();

  if (['completed', 'success', 'done', 'finished', 'complete'].includes(x)) {
    return 'completed';
  }

  if (['partial', 'partially', 'partial refunded', 'refunded_partial'].includes(x)) {
    return 'partial';
  }

  if (['fail', 'failed', 'rejected', 'error', 'declined'].includes(x)) {
    return 'failed';
  }

  if (['canceled', 'cancelled', 'cancel', 'refund', 'refunded'].includes(x)) {
    return 'canceled';
  }

  if (['inprogress', 'in_progress', 'progress'].includes(x)) {
    return 'inprogress';
  }

  if (['processing', 'pending', 'awaiting', 'queued', 'queue', 'new'].includes(x)) {
    return 'processing';
  }

  return 'processing';
}

function resolveNextStatus(currentLocal, providerRawStatus) {
  const local = String(currentLocal || '').trim().toLowerCase();
  const mapped = mapProviderStatus(providerRawStatus);

  if (local === 'canceling') {
    if (mapped === 'canceled') return 'canceled';
    if (mapped === 'completed') return 'completed';
    if (mapped === 'partial') return 'partial';
    return 'canceling';
  }

  return mapped;
}

function pickLastStatus(res) {
  const ls = res?.lastStatus || res || {};
  return {
    status: ls.status ?? res?.status ?? null,
    rawStatus: ls.rawStatus ?? ls.status ?? res?.rawStatus ?? res?.status ?? null,
    charge: toNum(ls.charge ?? res?.charge),
    currency: ls.currency ?? res?.currency ?? null,
    remains: toNum(ls.remains ?? res?.remains),
    start_count: toNum(ls.start_count ?? res?.start_count),
    current_count: toNum(ls.current_count ?? res?.current_count),
    providerOrderId: res?.id || res?.order_id || res?.providerOrderId || ls?.providerOrderId || null,
    checkedAt: new Date(),
  };
}

function computeDonePct(oLike) {
  const qty = Number(oLike?.quantity) || 0;
  if (qty <= 0) {
    const p = toNum(oLike?.progress);
    return p == null ? 0 : clamp(p, 0, 100);
  }

  const remains = toNum(oLike?.remains);
  if (remains != null) {
    return clamp((1 - Math.max(0, remains) / qty) * 100, 0, 100);
  }

  const startCount = toNum(oLike?.startCount);
  const currentCount = toNum(oLike?.currentCount);
  if (startCount != null && currentCount != null) {
    const gained = Math.max(0, currentCount - startCount);
    return clamp((gained / qty) * 100, 0, 100);
  }

  const p = toNum(oLike?.progress);
  return p == null ? 0 : clamp(p, 0, 100);
}

function normalizeTerminalStatus(status, refundType) {
  const st = String(status || '').toLowerCase();
  const rf = String(refundType || '').toLowerCase();

  if (st === 'canceled' && rf === 'partial') return 'partial';
  return st;
}

function computeRefund(orderDoc, providerResOrLastStatus) {
  const est = Number(orderDoc?.estCost ?? orderDoc?.cost ?? 0);
  if (!Number.isFinite(est) || est <= 0) return null;

  const src = providerResOrLastStatus?.lastStatus || providerResOrLastStatus || {};
  const mappedStatus = mapProviderStatus(
    src?.status ?? src?.rawStatus ?? providerResOrLastStatus?.status ?? providerResOrLastStatus?.rawStatus
  );

  const charge = toNum(src?.charge ?? providerResOrLastStatus?.charge);
  if (charge != null) {
    const refund = clamp(est - Math.max(0, charge), 0, est);
    if (mappedStatus === 'canceled' || mappedStatus === 'failed') {
      return {
        amount: refund,
        type: refund >= est ? 'full' : (refund > 0 ? 'partial' : 'full'),
      };
    }
    if (mappedStatus === 'partial') {
      return refund > 0 ? { amount: refund, type: 'partial' } : null;
    }
  }

  const qty = Number(orderDoc?.quantity) || 0;
  const remains = toNum(src?.remains ?? providerResOrLastStatus?.remains);
  if (qty > 0 && remains != null) {
    const done = clamp(qty - Math.max(0, remains), 0, qty);
    const chargedEstimated = est * (done / qty);
    const refund = clamp(est - chargedEstimated, 0, est);

    if (mappedStatus === 'canceled' || mappedStatus === 'failed') {
      return {
        amount: refund,
        type: refund >= est ? 'full' : 'partial',
      };
    }

    if (mappedStatus === 'partial') {
      return refund > 0 ? { amount: refund, type: 'partial' } : null;
    }
  }

  if (mappedStatus === 'canceled' || mappedStatus === 'failed') {
    return { amount: est, type: 'full' };
  }

  return null;
}

function buildPatch(orderDoc, providerRes) {
  const lastStatus = pickLastStatus(providerRes);
  const nextStatusRaw = resolveNextStatus(orderDoc?.status, lastStatus.rawStatus);

  const patch = {
    updatedAt: new Date(),
    'providerResponse.lastStatus': lastStatus,
    'providerResponse.lastCheckedAt': new Date(),
  };

  if (lastStatus.start_count != null) patch.startCount = lastStatus.start_count;
  if (lastStatus.current_count != null) patch.currentCount = lastStatus.current_count;
  if (lastStatus.remains != null) patch.remains = Math.max(0, lastStatus.remains);

  const pct = computeDonePct({
    quantity: orderDoc?.quantity,
    remains: patch.remains ?? orderDoc?.remains,
    startCount: patch.startCount ?? orderDoc?.startCount,
    currentCount: patch.currentCount ?? orderDoc?.currentCount,
    progress: orderDoc?.progress,
  });
  patch.progress = pct;

  if (String(nextStatusRaw || '') !== String(orderDoc?.status || '')) {
    patch.status = nextStatusRaw;
  }

  const candidateStatus = String(patch.status ?? orderDoc?.status ?? '').toLowerCase();

  if ((candidateStatus === 'partial' || candidateStatus === 'canceled' || candidateStatus === 'failed') && !orderDoc?.refundCommitted) {
    const rf = computeRefund(orderDoc, providerRes);
    if (rf && rf.amount > 0) {
      const prevAmt = Number(orderDoc?.refundAmount || 0);
      const mergedAmount = Math.max(prevAmt, rf.amount);
      patch.refundAmount = mergedAmount;
      patch.refundType =
        mergedAmount >= Number(orderDoc?.estCost ?? orderDoc?.cost ?? 0)
          ? 'full'
          : (rf.type || 'partial');

      log('REFUND_COMPUTED', {
        orderId: orderDoc?.providerOrderId,
        localStatus: orderDoc?.status,
        candidateStatus,
        refundAmount: mergedAmount,
        refundType: patch.refundType,
        estCost: Number(orderDoc?.estCost ?? orderDoc?.cost ?? 0),
      });
    }

    if (candidateStatus === 'canceled' && !orderDoc?.canceledAt) {
      patch.canceledAt = new Date();
    }
  }

  const finalCandidateStatus = normalizeTerminalStatus(
    patch.status ?? orderDoc?.status,
    patch.refundType ?? orderDoc?.refundType
  );

  if (finalCandidateStatus !== String(patch.status ?? orderDoc?.status ?? '').toLowerCase()) {
    patch.status = finalCandidateStatus;
  }

  // IMPORTANT:
  // Some providers report terminal/completed orders without refreshing the
  // numeric detail fields (remains/progress/current_count). If we leave the
  // old numbers in MongoDB, /my/orders can show a green "completed" modal
  // while the table pill still says 20%/58%. Terminal completed must always
  // have a terminal snapshot in our DB.
  const terminalStatus = String(patch.status ?? orderDoc?.status ?? '').toLowerCase();
  if (terminalStatus === 'completed') {
    const qty = Math.max(0, Number(orderDoc?.quantity || 0));
    const start = Number(patch.startCount ?? orderDoc?.startCount);

    patch.progress = 100;
    patch.remains = 0;

    if (qty > 0 && Number.isFinite(start)) {
      const computedCurrent = start + qty;
      const current = Number(patch.currentCount ?? orderDoc?.currentCount);
      patch.currentCount = Number.isFinite(current)
        ? Math.max(current, computedCurrent)
        : computedCurrent;
    }
  }

  return patch;
}

function logOrderUpdate({ orderDoc, patch, providerRawStatus }) {
  const from = String(orderDoc?.status || '-');
  const to = String(patch?.status ?? from);
  const prov = orderDoc?.providerOrderId || patch?.['providerResponse.lastStatus']?.providerOrderId || '-';

  log('ORDER_UPDATED', {
    providerOrderId: prov,
    from,
    to,
    providerRawStatus: providerRawStatus || '-',
    progress: patch?.progress ?? orderDoc?.progress ?? null,
    refundAmount: patch?.refundAmount ?? orderDoc?.refundAmount ?? 0,
    refundType: patch?.refundType ?? orderDoc?.refundType ?? null,
  });
}

async function fastReconcileOnce() {
  const target = await Order.find({
    status: { $in: ['completed', 'partial', 'canceled', 'failed'] },
    refundCommitted: { $ne: true },
  })
    .select('_id user status spentAccounted refundCommitted updatedAt providerOrderId')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  if (!target.length) {
    log('FAST_RECONCILE_EMPTY');
    return 0;
  }

  log('FAST_RECONCILE_START', { count: target.length });

  let changed = 0;
  for (const o of target) {
    try {
      await reconcileUserByOrderEvent(o._id, {
        force: true,
        reason: `fast_reconcile_${String(o.status || '').toLowerCase() || 'unknown'}`,
      });

      changed++;
      log('FAST_RECONCILE_OK', {
        orderId: o?.providerOrderId || o?._id,
        status: o?.status,
      });
    } catch (e) {
      warn('FAST_RECONCILE_FAIL', {
        orderId: o?.providerOrderId || o?._id,
        error: e?.message || e,
      });
    }
  }

  log('FAST_RECONCILE_DONE', { changed });
  return changed;
}

function ensureFastRunner() {
  if (fastTimer) return;

  const fastScanMs = getFastScanMs();

  log('FAST_RUNNER_START', { intervalMs: fastScanMs });

  fastTimer = setInterval(async () => {
    if (fastRunnerRunning) {
      log('FAST_RUNNER_SKIP_ALREADY_RUNNING');
      return;
    }

    fastRunnerRunning = true;

    try {
      const n = await fastReconcileOnce();
      if (n === 0) {
        clearInterval(fastTimer);
        fastTimer = null;
        log('FAST_RUNNER_STOP_EMPTY');
      }
    } catch (e) {
      warn('FAST_RUNNER_ERROR', e?.message || e);
    } finally {
      fastRunnerRunning = false;
    }
  }, fastScanMs);
}

async function claimAutoCancel(orderDoc) {
  const now = new Date();
  const createdAt = new Date(orderDoc?.createdAt || 0);
  const ageMs = now.getTime() - createdAt.getTime();

  const isPending = ['processing', 'pending'].includes(String(orderDoc?.status || '').toLowerCase());
  if (!isPending) return false;
  if (!(ageMs > getAutoCancelAfterMs())) return false;

  const claim = await Order.updateOne(
    {
      _id: orderDoc._id,
      status: { $in: ['processing', 'pending'] },
      $or: [
        { lastCancelId: { $exists: false } },
        { lastCancelId: null },
        { lastCancelId: '' },
      ],
    },
    {
      $set: {
        lastCancelId: AUTO_CANCEL_PENDING,
        updatedAt: new Date(),
      },
    }
  );

  const claimed = isModified(claim);

  if (claimed) {
    log('AUTO_CANCEL_CLAIMED', {
      orderId: orderDoc?.providerOrderId,
      ageMs,
    });
  }

  return claimed;
}

async function autoCancelIfStuck(orderDoc) {
  const claimed = await claimAutoCancel(orderDoc);
  if (!claimed) return false;

  try {
    const resp = await cancelOrder(orderDoc.providerOrderId);
    const cancelId = resp?.cancelId || AUTO_CANCEL_FALLBACK;

    await Order.updateOne(
      { _id: orderDoc._id, lastCancelId: AUTO_CANCEL_PENDING },
      {
        $set: {
          status: 'canceling',
          lastCancelId: cancelId,
          updatedAt: new Date(),
          'meta.autoCanceled': true,
        },
      }
    );

    log('AUTO_CANCEL_OK', {
      orderId: orderDoc?.providerOrderId,
      cancelId,
    });

    return true;
  } catch (e) {
    await Order.updateOne(
      { _id: orderDoc._id, lastCancelId: AUTO_CANCEL_PENDING },
      {
        $unset: { lastCancelId: '' },
        $set: { updatedAt: new Date() },
      }
    );

    warn('AUTO_CANCEL_FAIL', {
      orderId: orderDoc?.providerOrderId,
      error: e?.message || e,
    });

    return false;
  }
}

async function reconcileAfterTerminal(orderDoc, patch) {
  const finalStatus = String(patch?.status ?? orderDoc?.status ?? '').toLowerCase();
  if (!['completed', 'partial', 'canceled', 'failed'].includes(finalStatus)) return;

  try {
    log('RECONCILE_START', {
      orderId: orderDoc?.providerOrderId || orderDoc?._id,
      finalStatus,
      refundAmount: patch?.refundAmount ?? orderDoc?.refundAmount ?? 0,
      refundType: patch?.refundType ?? orderDoc?.refundType ?? null,
    });

    await reconcileUserByOrderEvent(orderDoc._id, {
      force: true,
      reason: `job_status_update_${finalStatus}`,
    });

    log('RECONCILE_OK', {
      orderId: orderDoc?.providerOrderId || orderDoc?._id,
      finalStatus,
    });
  } catch (e) {
    errlog('RECONCILE_FAIL', {
      orderId: orderDoc?.providerOrderId || orderDoc?._id,
      finalStatus,
      error: e?.message || e,
    });
  }

  if (orderDoc?.user) {
    setTimeout(() => {
      recalcUserTotals(String(orderDoc.user), { force: true })
        .then(() => {
          log('RECALC_USER_TOTALS_OK', {
            userId: String(orderDoc.user),
            orderId: orderDoc?.providerOrderId || orderDoc?._id,
          });
        })
        .catch((e) => {
          warn('RECALC_USER_TOTALS_FAIL', {
            userId: String(orderDoc.user),
            orderId: orderDoc?.providerOrderId || orderDoc?._id,
            error: e?.message || e,
          });
        });
    }, 0);
  }

  ensureFastRunner();
}

async function updateOneOrder(orderDoc) {
  if (!orderDoc?.providerOrderId) return;

  const autoCanceled = await autoCancelIfStuck(orderDoc);
  if (autoCanceled) return;

  let providerRes;
  try {
    providerRes = await getOrderStatus(orderDoc.providerOrderId);
  } catch (e) {
    warn('PROVIDER_STATUS_FAIL', {
      orderId: orderDoc?.providerOrderId,
      error: e?.message || e,
    });
    return;
  }

  const providerLast = pickLastStatus(providerRes);

  log('PROVIDER_STATUS_OK', {
    orderId: orderDoc?.providerOrderId,
    status: providerLast?.status,
    rawStatus: providerLast?.rawStatus,
    remains: providerLast?.remains,
    charge: providerLast?.charge,
    start_count: providerLast?.start_count,
    current_count: providerLast?.current_count,
  });

  const patch = buildPatch(orderDoc, providerRes);

  const nextStatus = String(patch.status ?? orderDoc.status ?? '');
  const currentStatus = String(orderDoc.status ?? '');
  const nextRefundAmount = Number(patch.refundAmount ?? orderDoc.refundAmount ?? 0);
  const currentRefundAmount = Number(orderDoc.refundAmount ?? 0);
  const nextRefundType = String(patch.refundType ?? orderDoc.refundType ?? '');
  const currentRefundType = String(orderDoc.refundType ?? '');
  const nextProgress = Number(patch.progress ?? orderDoc.progress ?? 0);
  const currentProgress = Number(orderDoc.progress ?? 0);
  const nextRemains = Number(patch.remains ?? orderDoc.remains ?? NaN);
  const currentRemains = Number(orderDoc.remains ?? NaN);
  const nextStart = Number(patch.startCount ?? orderDoc.startCount ?? NaN);
  const currentStart = Number(orderDoc.startCount ?? NaN);
  const nextCurrent = Number(patch.currentCount ?? orderDoc.currentCount ?? NaN);
  const currentCurrent = Number(orderDoc.currentCount ?? NaN);

  const noMeaningfulChange =
    nextStatus === currentStatus &&
    nextRefundAmount === currentRefundAmount &&
    nextRefundType === currentRefundType &&
    nextProgress === currentProgress &&
    nextRemains === currentRemains &&
    nextStart === currentStart &&
    nextCurrent === currentCurrent;

  const updateRes = await Order.updateOne(
    { _id: orderDoc._id },
    { $set: patch }
  );

  if (!isModified(updateRes) && noMeaningfulChange) {
    log('ORDER_NO_MEANINGFUL_CHANGE', {
      orderId: orderDoc?.providerOrderId,
      status: currentStatus,
    });
    return;
  }

  logOrderUpdate({
    orderDoc,
    patch,
    providerRawStatus: providerLast.rawStatus || providerLast.status || 'processing',
  });

  await reconcileAfterTerminal(orderDoc, patch);
}

export async function tickOnce() {
  if (tickRunning) {
    log('TICK_SKIP_ALREADY_RUNNING');
    return;
  }

  tickRunning = true;
  const startedAt = Date.now();

  const tickMs = getTickMs();
  const concurrency = getConcurrency();
  const batchLimit = getBatchLimit();

  try {
    log('TICK_START', {
      tickMs,
      concurrency,
      batchLimit,
    });

    const fields = {
      _id: 1,
      user: 1,
      status: 1,
      providerOrderId: 1,
      estCost: 1,
      cost: 1,
      quantity: 1,
      refundCommitted: 1,
      refundAmount: 1,
      refundType: 1,
      startCount: 1,
      currentCount: 1,
      remains: 1,
      progress: 1,
      updatedAt: 1,
      createdAt: 1,
      lastCancelId: 1,
      spentAccounted: 1,
      canceledAt: 1,
      'providerResponse.lastCheckedAt': 1,
    };

    const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const coldCutoff = new Date(Date.now() - 60 * 60 * 1000);
    const recentCheckedBefore = new Date(Date.now() - getRecentCheckMs());
    const warmCheckedBefore = new Date(Date.now() - getWarmCheckMs());
    const coldCheckedBefore = new Date(Date.now() - getColdCheckMs());
    const terminalCheckedBefore = new Date(Date.now() - getTerminalCleanupCheckMs());

    const neverChecked = {
      $or: [
        { 'providerResponse.lastCheckedAt': { $exists: false } },
        { 'providerResponse.lastCheckedAt': null },
      ],
    };

    const activeStatusFilter = {
      providerOrderId: { $exists: true, $ne: null },
      status: { $in: ['processing', 'inprogress', 'canceling'] },
      $or: [
        neverChecked,
        { status: 'canceling', 'providerResponse.lastCheckedAt': { $lte: recentCheckedBefore } },
        { createdAt: { $gte: recentCutoff }, 'providerResponse.lastCheckedAt': { $lte: recentCheckedBefore } },
        { createdAt: { $lt: recentCutoff, $gte: coldCutoff }, 'providerResponse.lastCheckedAt': { $lte: warmCheckedBefore } },
        { createdAt: { $lt: coldCutoff }, 'providerResponse.lastCheckedAt': { $lte: coldCheckedBefore } },
      ],
    };

    const filter = {
      providerOrderId: { $exists: true, $ne: null },
      $or: [
        activeStatusFilter,
        { status: { $in: ['canceled', 'partial', 'failed'] }, refundCommitted: { $ne: true } },
        // Cleanup legacy/stale completed rows whose DB detail fields still
        // show partial progress even though provider/local status is completed.
        {
          status: 'completed',
          $or: [{ progress: { $lt: 99.995 } }, { remains: { $gt: 0 } }],
          $and: [
            {
              $or: [
                neverChecked,
                { 'providerResponse.lastCheckedAt': { $lte: terminalCheckedBefore } },
              ],
            },
          ],
        },
      ],
    };

    const previewCount = await Order.countDocuments(filter);
    log('TICK_MATCHED_COUNT', { count: previewCount });

    const limit = pLimit(concurrency);
    const cursor = Order.find(filter, fields)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(batchLimit)
      .lean()
      .cursor();

    let queued = 0;
    const tasks = [];

    for (let row = await cursor.next(); row != null; row = await cursor.next()) {
      queued++;
      tasks.push(limit(() => updateOneOrder(row)));
    }

    log('TICK_QUEUED', { queued });

    const results = await Promise.allSettled(tasks);

    let fulfilled = 0;
    let rejected = 0;

    for (const r of results) {
      if (r.status === 'fulfilled') fulfilled++;
      else rejected++;
    }

    log('TICK_DONE', {
      queued,
      fulfilled,
      rejected,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    errlog('TICK_FAIL', e?.message || e);
  } finally {
    tickRunning = false;
  }
}

export function startOrderStatusJob() {
  if (started) {
    log('ALREADY_STARTED');
    return () => {};
  }

  started = true;

  const instanceId = getInstanceId();
  const tickMs = getTickMs();
  const concurrency = getConcurrency();
  const batchLimit = getBatchLimit();
  const fastScanMs = getFastScanMs();
  const autoCancelAfterMs = getAutoCancelAfterMs();

  connectMongoIfNeeded()
    .then(() => {
      log('MONGO_CONNECTED', { instanceId });
    })
    .catch((e) => {
      errlog('MONGO_CONNECT_FAIL', e?.message || e);
    });

  Promise.resolve()
    .then(() => tickOnce())
    .catch((e) => errlog('BOOT_TICK_FAIL', e?.message || e));

  mainTimer = setInterval(() => {
    tickOnce().catch((e) => errlog('INTERVAL_TICK_FAIL', e?.message || e));
  }, tickMs);

  ensureFastRunner();

  log('JOB_STARTED', {
    instanceId,
    tickMs,
    concurrency,
    batchLimit,
    fastScanMs,
    autoCancelAfterMs,
  });

  return () => {
    if (mainTimer) {
      clearInterval(mainTimer);
      mainTimer = null;
    }

    if (fastTimer) {
      clearInterval(fastTimer);
      fastTimer = null;
    }

    tickRunning = false;
    fastRunnerRunning = false;
    started = false;

    log('JOB_STOPPED');
  };
}