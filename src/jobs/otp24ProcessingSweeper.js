// src/services/otp24ProcessingSweeper.js
import pLimit from 'p-limit';
import { config } from '../config.js';
import { Otp24Order } from '../models/Otp24Order.js';
import { User } from '../models/User.js';
import { getOtpStatus } from '../lib/otp24Adapter.js';
import { log, warn, errlog } from '../utils/logger.js';

let timer = null;
let started = false;
let running = false;

function safeNumber(value, fallback, min = 1) {
  const n = Number(value);
  return Math.max(min, Number.isFinite(n) ? n : fallback);
}

function getIntervalMs() {
  return safeNumber(config?.jobs?.otp24SweeperIntervalMs, 15000, 5000);
}

function getBatchLimit() {
  return safeNumber(config?.jobs?.otp24SweeperBatchLimit, 200, 1);
}

function getProviderConcurrency() {
  return safeNumber(config?.jobs?.otp24SweeperConcurrency, 5, 1);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeStatus(v) {
  return String(v || '').trim().toLowerCase();
}

/**
 * ใช้ TTL จาก config.otp.ttlSec
 * ค่า default = 600 วินาที / 10 นาที
 */
const OTP24_TTL_MS = safeNumber(config?.otp?.ttlSec, 600, 1) * 1000;

function getOtp24ExpiresAt(row) {
  if (row?.expiresAt) return new Date(row.expiresAt);

  const base =
    row?.createdAt ||
    row?.created_at ||
    row?.updatedAt ||
    row?._id?.getTimestamp?.() ||
    new Date();

  return new Date(new Date(base).getTime() + OTP24_TTL_MS);
}

function isExpired(row, now = Date.now()) {
  return getOtp24ExpiresAt(row).getTime() <= now;
}

/**
 * OTP จริงเท่านั้นที่ถือว่าสำเร็จ
 * ค่า '0' / ข้อความไม่พบ OTP ต้องถือว่า "ไม่มี OTP"
 */
function hasRealOtp(v) {
  const s = String(v || '').trim();
  if (!s) return false;

  const x = s.toLowerCase();
  if (
    x === '0' ||
    x === '-' ||
    x === 'null' ||
    x === 'undefined' ||
    x === 'false' ||
    x === 'n/a' ||
    x === 'na'
  ) {
    return false;
  }

  if (
    x.includes('ไม่พบ') ||
    x.includes('ไม่มี') ||
    x.includes('no otp') ||
    x.includes('not found') ||
    x.includes('not received')
  ) {
    return false;
  }

  return true;
}

function noOtpMongoOr() {
  return [
    { otp: { $exists: false } },
    { otp: null },
    { otp: '' },
    { otp: '0' },
    { otp: '-' },
    { otp: /^ไม่พบ/i },
    { otp: /^ไม่มี/i },
    { otp: /no otp/i },
    { otp: /not found/i },
    { otp: /not received/i },
  ];
}

function isFailureStatus(st) {
  const s = normalizeStatus(st);
  return (
    s === 'timeout' ||
    s === 'failed' ||
    s === 'fail' ||
    s.includes('timeout') ||
    s.includes('expired') ||
    s.includes('expire') ||
    s.includes('fail') ||
    s.includes('error') ||
    s.includes('cancel') ||
    s === 'reject' ||
    s === 'rejected'
  );
}

function isRefundedStatus(st) {
  const s = normalizeStatus(st);
  return s.includes('refund') || s === 'refunded';
}

function isProviderSuccessStatus(st) {
  const s = normalizeStatus(st);
  return (
    s.includes('success') ||
    s.includes('complete') ||
    s.includes('done') ||
    s === 'ok'
  );
}

function isFinalNoOtpMessage(msg) {
  const s = String(msg || '').trim().toLowerCase();
  return (
    s.includes('ไม่พบข้อความ') ||
    s.includes('ไม่พบ otp') ||
    s.includes('ไม่มี otp') ||
    s.includes('no otp') ||
    s.includes('otp not found') ||
    s.includes('not received') ||
    s.includes('not found')
  );
}

/**
 * คืนเครดิตแบบกันซ้ำ
 *
 * รองรับ 2 เคสสำคัญ:
 * 1) status=success แต่ไม่มี OTP จริง เช่น otp='0' => คืนเครดิต + status=refunded
 * 2) status=refunded แต่ refundApplied=false => คืนเครดิต + refundApplied=true
 *
 * หมายเหตุ: ห้ามกันด้วย status != refunded เพราะเคส refunded แต่ยังไม่คืนเงินต้องคืนให้ได้
 */
async function refundOnce(row, reason) {
  // ✅ HARD GUARD: ห้าม refund ก่อนครบ 10 นาทีจาก createdAt/expiresAt
  if (!isExpired(row)) {
    log('REFUND_BLOCKED_NOT_EXPIRED', {
      orderId: row.orderId,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: getOtp24ExpiresAt(row),
      now: new Date(),
    });

    return false;
  }

  const sale = round2(Number(row.salePrice || row.refundAmount || 0));
  const msg = reason || 'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ';

  log('REFUND_START', {
    orderId: row.orderId,
    dbStatus: row.status,
    refundApplied: row.refundApplied,
    otp: row.otp,
    otpSpentAccounted: row.otpSpentAccounted,
    reason: msg,
    amount: sale,
  });

  try {
    const now = new Date();
    const cutoffCreatedAt = new Date(Date.now() - OTP24_TTL_MS);

    const res = await Otp24Order.updateOne(
      {
        _id: row._id,
        refundApplied: { $ne: true },

        // ✅ DB-level guard: ต้องครบเวลาแล้วเท่านั้น
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
            // ✅ คืนได้เฉพาะรายการที่ไม่มี OTP จริง รวม otp='0'
            $or: noOtpMongoOr(),
          },
        ],

        // ✅ ห้ามคืนรายการที่ยกเลิกแล้วเท่านั้น
        status: { $nin: ['canceled'] },
      },
      {
        $set: {
          status: 'refunded',
          message: msg,
          refundApplied: true,
          refundAmount: sale,
          refundedAt: new Date(),
          refundNote: msg,
          otpSpentAccounted: 0,
        },
      }
    );

    if (res.modifiedCount !== 1) {
      log('REFUND_SKIP', {
        orderId: row.orderId,
        reason: 'not expired / already refunded / canceled / has real otp / not matched',
      });
      return false;
    }

    log('REFUND_DB_OK', row.orderId);

    if (sale > 0 && row.user) {
      try {
        await User.updateOne(
          { _id: row.user },
          { $inc: { balance: sale } }
        );

        log('BALANCE_OK', {
          user: row.user,
          amount: sale,
        });
      } catch (e) {
        errlog('BALANCE_FAIL ❌', {
          orderId: row.orderId,
          error: e?.message || e,
        });
      }
    }

    log('REFUND_DONE ✅', row.orderId);
    return true;
  } catch (e) {
    errlog('REFUND_ERROR ❌', {
      orderId: row.orderId,
      error: e?.message || e,
    });

    return false;
  }
}

/**
 * สำเร็จจริงได้ก็ต่อเมื่อ provider ส่ง OTP จริงกลับมาเท่านั้น
 * status success แต่ otp ว่าง/0/ไม่พบข้อความ = ยังไม่สำเร็จ
 */
async function markSuccessOnce(row, otp, message) {
  const code = String(otp || '').trim();
  if (!hasRealOtp(code)) return false;

  try {
    const res = await Otp24Order.updateOne(
      {
        _id: row._id,
        status: 'processing',
        refundApplied: { $ne: true },
        $or: noOtpMongoOr(),
      },
      {
        $set: {
          status: 'success',
          otp: code,
          message: message || 'ได้รับ OTP แล้ว',
          completedAt: new Date(),
        },
      }
    );

    if (res.modifiedCount === 1) {
      log('SUCCESS ✅', row.orderId);
      return true;
    }

    log('SUCCESS_SKIP', {
      orderId: row.orderId,
      reason: 'not processing / refunded / already has real otp',
    });

    return false;
  } catch (e) {
    errlog('SUCCESS_ERROR ❌', {
      orderId: row.orderId,
      error: e?.message || e,
    });

    return false;
  }
}

async function processProvider(row) {
  try {
    const r = await getOtpStatus(row.orderId);

    if (!r?.ok) return;

    const st = String(r.status || '').trim().toLowerCase();
    const otp = String(r.otp || '').trim();
    const msg = String(r.msg || r.message || '').trim();

    const expired = isExpired(row);

    // ✅ มี OTP จริงเท่านั้น ถึงจะสำเร็จ
    if (hasRealOtp(otp)) {
      await markSuccessOnce(row, otp, msg || 'ได้รับ OTP แล้ว');
      return;
    }

    /**
     * ✅ Provider แจ้ง refunded / failed / no otp / success แต่ไม่มี OTP
     * ห้ามคืนเงินทันที ถ้ายังไม่ครบ 10 นาที
     * ให้บันทึกข้อความไว้ และคงสถานะ processing เพื่อรอครบเวลา
     */
    const providerSaysNoOtpOrFail =
      isRefundedStatus(st) ||
      isFailureStatus(st) ||
      isFinalNoOtpMessage(msg) ||
      isProviderSuccessStatus(st);

    if (providerSaysNoOtpOrFail && !expired) {
      await Otp24Order.updateOne(
        {
          _id: row._id,
          refundApplied: { $ne: true },
          status: { $nin: ['refunded', 'canceled', 'success'] },
        },
        {
          $set: {
            status: 'processing',
            message: msg || 'ระบบกำลังรอ OTP…',
            providerLastStatus: st || null,
            providerLastMessage: msg || null,
            checkedAt: new Date(),
          },
        }
      );

      log('WAIT_UNTIL_EXPIRED', {
        orderId: row.orderId,
        providerStatus: st,
        expired,
        message: msg,
      });

      return;
    }

    /**
     * ✅ ครบ 10 นาทีแล้ว และยังไม่มี OTP จริง
     * ถึงค่อยคืนเงิน
     */
    if (expired && !hasRealOtp(otp) && !row.refundApplied) {
      await refundOnce(
        row,
        msg || 'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
      );
      return;
    }

    /**
     * ✅ สถานะอื่น ๆ ยังไม่หมดเวลา = อัปเดต message ได้ แต่ไม่ refund
     */
    if (msg) {
      await Otp24Order.updateOne(
        {
          _id: row._id,
          refundApplied: { $ne: true },
          status: { $nin: ['refunded', 'canceled', 'success'] },
        },
        {
          $set: {
            status: 'processing',
            message: msg,
            providerLastStatus: st || null,
            providerLastMessage: msg || null,
            checkedAt: new Date(),
          },
        }
      );
    }
  } catch (e) {
    warn('PROVIDER_FAIL', {
      orderId: row.orderId,
      error: e?.message || e,
    });
  }
}

export async function sweepOnce() {
  if (running) {
    log('SKIP (loop running)');
    return;
  }

  running = true;

  try {
    const now = Date.now();
    const batchLimit = getBatchLimit();
    const providerConcurrency = getProviderConcurrency();

    /**
     * ดึงรายการที่ต้องจัดการ:
     * - processing: เช็ค provider / หมดเวลาคืนเงิน
     * - timeout/failed/fail/refunded: คืนเงินถ้ายัง refundApplied=false
     * - success แต่ไม่มี OTP จริง เช่น otp='' หรือ otp='0': คืนเงินทันที
     */
    const list = await Otp24Order.find({
      $or: [
        { status: { $in: ['processing', 'timeout', 'failed', 'fail'] } },

        // ✅ เคส refunded แล้ว แต่ยังไม่ได้คืนเงินจริง
        {
          status: 'refunded',
          refundApplied: { $ne: true },
        },

        // ✅ เคส success ปลอม ไม่มี OTP จริง
        {
          status: 'success',
          $or: noOtpMongoOr(),
        },
      ],
    })
      .select(
        '_id orderId message expiresAt createdAt updatedAt user salePrice status refundApplied refundAmount refundedAt otp otpSpentAccounted'
      )
      .sort({ createdAt: 1, _id: 1 })
      .limit(batchLimit)
      .lean();

    log('SWEEP_START', {
      total: list.length,
      batchLimit,
      providerConcurrency,
    });

    const providerTargets = [];

    for (const row of list) {
      const st = normalizeStatus(row.status);
      const rowHasOtp = hasRealOtp(row.otp);
      const rowExpired = isExpired(row, now);

      /**
       * ✅ ถ้ามี OTP จริงแล้ว ห้าม refund เด็ดขาด
       */
      if (rowHasOtp) {
        continue;
      }

      /**
       * ✅ เคส success แต่ไม่มี OTP จริง เช่น otp='0'
       * ห้าม refund ทันที ต้องรอครบ 10 นาทีก่อน
       */
      if (st === 'success' && !rowHasOtp && !row.refundApplied) {
        if (!rowExpired) {
          await Otp24Order.updateOne(
            {
              _id: row._id,
              refundApplied: { $ne: true },
              status: 'success',
              $or: noOtpMongoOr(),
            },
            {
              $set: {
                status: 'processing',
                message: row.message || 'ระบบกำลังรอ OTP…',
                checkedAt: new Date(),
              },
            }
          );

          log('SUCCESS_NO_OTP_WAIT', {
            orderId: row.orderId,
            expired: rowExpired,
          });

          continue;
        }

        await refundOnce(
          row,
          'ครบเวลารอ OTP แล้ว แต่รายการสำเร็จโดยไม่มี OTP ระบบคืนเครดิตอัตโนมัติ'
        );
        continue;
      }

      /**
       * ✅ เคส refunded แล้ว แต่ refundApplied=false
       * ต้องคืนเงินหลังครบ 10 นาทีเท่านั้น
       */
      if (st === 'refunded' && !row.refundApplied && !rowHasOtp) {
        if (!rowExpired) {
          log('REFUNDED_WAIT_UNTIL_EXPIRED', {
            orderId: row.orderId,
            expired: rowExpired,
          });

          continue;
        }

        await refundOnce(
          row,
          row.message || 'ครบเวลารอ OTP แล้ว รายการถูกคืนเงินจากผู้ให้บริการ ระบบคืนเครดิตอัตโนมัติ'
        );
        continue;
      }

      /**
       * ✅ processing หมดเวลาแล้ว + ไม่มี OTP = คืนเครดิต
       */
      if (st === 'processing' && !rowHasOtp && rowExpired && !row.refundApplied) {
        await refundOnce(
          row,
          'ไม่ได้รับ OTP ภายในเวลาที่กำหนด ระบบคืนเครดิตอัตโนมัติ'
        );
        continue;
      }

      /**
       * ✅ failure status ใน DB
       * ห้าม refund ก่อนครบ 10 นาที
       */
      if (!row.refundApplied && !rowHasOtp && isFailureStatus(st)) {
        if (!rowExpired) {
          await Otp24Order.updateOne(
            {
              _id: row._id,
              refundApplied: { $ne: true },
              status: { $nin: ['refunded', 'canceled', 'success'] },
            },
            {
              $set: {
                status: 'processing',
                message: row.message || 'ระบบกำลังรอ OTP…',
                checkedAt: new Date(),
              },
            }
          );

          log('FAIL_STATUS_WAIT_UNTIL_EXPIRED', {
            orderId: row.orderId,
            status: st,
            expired: rowExpired,
          });

          continue;
        }

        await refundOnce(row, 'ครบเวลารอ OTP แล้ว ไม่ได้รับ OTP ระบบคืนเครดิตอัตโนมัติ');
        continue;
      }

      /**
       * ✅ processing ที่ยังไม่หมดเวลา = เช็ค provider
       */
      if (st === 'processing') {
        providerTargets.push(row);
      }
    }

    const limit = pLimit(providerConcurrency);

    await Promise.allSettled(
      providerTargets.map((row) =>
        limit(() => processProvider(row))
      )
    );
  } catch (e) {
    errlog('SWEEP_ERROR ❌', e?.message || e);
  } finally {
    running = false;
  }
}

export function startOtp24ProcessingSweeper() {
  if (started) {
    log('ALREADY_STARTED');
    return () => {};
  }

  started = true;

  const intervalMs = getIntervalMs();
  const batchLimit = getBatchLimit();
  const providerConcurrency = getProviderConcurrency();

  log('START_SWEEPER', {
    interval: intervalMs,
    batch: batchLimit,
    concurrency: providerConcurrency,
    ttlMs: OTP24_TTL_MS,
  });

  sweepOnce().catch((e) => {
    errlog('BOOT_SWEEP_ERROR ❌', e?.message || e);
  });

  timer = setInterval(() => {
    sweepOnce().catch((e) => {
      errlog('INTERVAL_SWEEP_ERROR ❌', e?.message || e);
    });
  }, intervalMs);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    running = false;
    started = false;

    log('STOP_SWEEPER');
  };
}
