// src/jobs/topupAutoRejectJob.js
import { config } from '../config.js';
import { Transaction } from '../models/Transaction.js';
import { log, errlog } from '../utils/logger.js';

let BUSY = false;

function safeNumber(value, fallback, min = 1) {
  const n = Number(value);
  return Math.max(min, Number.isFinite(n) ? n : fallback);
}

function getBatchSize() {
  return safeNumber(config?.jobs?.topupRejectBatchSize, 100, 10);
}

// ✅ รายการที่ “ไม่มี userId” คือยอดเงินเข้าที่ระบบจับได้ แต่ผู้ใช้ไม่ได้สร้างรายการเติมเงินจากเว็บ
// ให้ reject เร็วกว่าเดิม เพื่อไม่ให้ค้างในหลังบ้านนานเกินไป
// ตั้งค่าได้ที่ secure_config/config jobs.topupRejectAgeMinutes เช่น 3, 5, 10
// ยังรองรับค่าเก่า jobs.topupRejectAgeHours เผื่อระบบเดิมตั้งไว้แล้ว
function getAgeMinutes() {
  if (config?.jobs?.topupRejectAgeMinutes != null) {
    return safeNumber(config.jobs.topupRejectAgeMinutes, 5, 1);
  }

  if (config?.jobs?.topupRejectAgeHours != null) {
    return safeNumber(config.jobs.topupRejectAgeHours, 1, 1) * 60;
  }

  return 5;
}

function makeRunId() {
  return `reject_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function extractModifiedCount(res) {
  return Number(res?.modifiedCount || res?.nModified || 0);
}

function buildRejectNote(tx) {
  const tag = 'auto-reject:no-user';
  const note0 = String(tx.note || '').trim();

  if (note0.includes(tag)) return note0;
  return note0 ? `${note0} | ${tag}` : tag;
}

async function autoRejectOrphanTopups() {
  const runId = makeRunId();

  if (BUSY) {
    log('TOPUP_REJECT_SKIP_BUSY', { runId });
    return { ok: true, skipped: true, changed: 0 };
  }

  BUSY = true;
  const startedAt = Date.now();

  try {
    const batchSize = getBatchSize();
    const ageMinutes = getAgeMinutes();
    const cutoff = new Date(Date.now() - ageMinutes * 60 * 1000);

    log('TOPUP_REJECT_RUN_START', {
      runId,
      batchSize,
      ageMinutes,
      cutoff
    });

    // ✅ สำคัญ:
    // reject เฉพาะรายการ pending ที่ไม่มี userId เท่านั้น
    // รายการที่มี userId คือผู้ใช้กดสร้างรายการจากหน้าเว็บ ต้องปล่อยให้รออนุมัติ/รอ match ต่อไป
    const orphanFilter = {
      status: 'pending',
      createdAt: { $lte: cutoff },
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    };

    const candidates = await Transaction.find(orphanFilter)
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .select('_id transactionId method amount amountCents note createdAt occurredAt rawMessage ipAddress')
      .lean();

    if (!candidates.length) {
      log('TOPUP_REJECT_EMPTY', { runId, ageMinutes });
      return { ok: true, scanned: 0, changed: 0 };
    }

    const now = new Date();

    const ops = candidates.map((tx) => ({
      updateOne: {
        filter: {
          _id: tx._id,
          status: 'pending',
          $or: [
            { userId: { $exists: false } },
            { userId: null }
          ]
        },
        update: {
          $set: {
            status: 'reject',
            note: buildRejectNote(tx),
            rejectedAt: now,
            rejectReason: 'NO_USER_ID_OR_UNMATCHED_TOPUP'
          }
        }
      }
    }));

    const res = await Transaction.bulkWrite(ops, { ordered: false });
    const changed = extractModifiedCount(res);

    log('TOPUP_REJECT_RUN_DONE', {
      runId,
      scanned: candidates.length,
      changed,
      ageMinutes,
      durationMs: Date.now() - startedAt
    });

    return {
      ok: true,
      scanned: candidates.length,
      changed,
      ageMinutes
    };
  } catch (error) {
    errlog('TOPUP_REJECT_RUN_FAIL', {
      runId,
      error: error?.message || error
    });

    return {
      ok: false,
      error: error?.message || String(error)
    };
  } finally {
    BUSY = false;
  }
}

// ✅ ใช้กับ queue worker
export async function runTopupAutoRejectOnce() {
  return autoRejectOrphanTopups();
}
