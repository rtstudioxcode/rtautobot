// src/services/spendWatcher.js
import mongoose from 'mongoose';

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

const POKE_FIELDS = new Set([
  'status','cost','estCost','charged','refundAmount',
  'quantity','rateAtOrder','rate','partialRefunds',
  'remains','startCount','currentCount','progress',
  'spentAccounted'
]);

// OTP24: เรานับเฉพาะ success + salePrice
const OTP24_POKE_FIELDS = new Set(['status','salePrice','refundAmount']);

const userQueue = new Map();
function scheduleUser(userId, fn) {
  const key = String(userId);
  if (userQueue.has(key)) clearTimeout(userQueue.get(key));
  const t = setTimeout(fn, 2500);
  userQueue.set(key, t);
}

// ─────────────────────────────────────────────────────────────
// Polling fallback (ไม่มี/หลุด change streams)
// ─────────────────────────────────────────────────────────────
async function startPollingFallback(mongooseConn, intervalMs = 30000) {
  // glog.warn('[spendWatcher] using polling fallback (no replica set).');
  const Order = mongooseConn.model('Order');
  const Otp24Order = mongooseConn.model('Otp24Order');

  let last = new Date(Date.now() - 60 * 1000);

  const timer = setInterval(async () => {
    try {
      const [changedOrd, changedOtp] = await Promise.all([
        Order.find({ updatedAt: { $gt: last } }, { _id:1, userId:1, user:1, updatedAt:1, refundCommitted:1 }).lean(),
        Otp24Order.find({ updatedAt: { $gt: last } }, { _id:1, userId:1, user:1, updatedAt:1 }).lean(),
      ]);

      const otpSet = new Set(changedOtp.map(d => String(d._id)));
      const all = [...changedOrd, ...changedOtp];

      if (all.length) {
        const newest = all.reduce((m, d) => (d.updatedAt > m ? d.updatedAt : m), last);
        last = new Date(Math.max(+last, +newest));

        for (const doc of all) {
          // ✅ จุดที่ 1 (Polling): ถ้าคืนเงินไปแล้ว ให้ข้าม (Skip)
          if (doc.refundCommitted === true) continue;

          const uid = doc.userId || doc.user;
          if (!uid) continue;

          (async () => {
            try {
              if (otpSet.has(String(doc._id))) {
                const { reconcileOtp24OrderSpend } = await import('./spend.js');
                await reconcileOtp24OrderSpend(doc._id);
              } else {
                const { reconcileOrderSpend } = await import('./spend.js');
                await reconcileOrderSpend(doc._id);
              }
            } catch (e) {
              // glog.error('[spendWatcher/poll] reconcile failed:', e?.message || e);
            }
          })();

          scheduleUser(uid, async () => {
            try {
              const { recalcUserTotals } = await import('./spend.js');
              await recalcUserTotals(uid, { force: true, reason: 'polling' });
            } catch (e) {
              // glog.error('[spendWatcher/poll] recalcUserTotals failed:', e?.message || e);
            }
          });
        }
      }
    } catch (e) {
      // glog.error('[spendWatcher/poll] error:', e?.message || e);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

// ─────────────────────────────────────────────────────────────
// Change streams (ตัวจริง เสียบเมื่อ replica set พร้อม)
// ─────────────────────────────────────────────────────────────
export function startSpendAutoRecalc(mongooseConn = mongoose.connection) {
  const collOrders = mongooseConn.collection('orders');
  const collOtp24  = mongooseConn.collection('otp24orders');

  if (!collOrders?.watch || !collOtp24?.watch) {
    // glog.warn('[spendWatcher] change streams unsupported (no watch). Using polling.');
    return startPollingFallback(mongooseConn);
  }

  const startWatch = (coll, kind) => {
    const pipeline = [{ $match: { operationType: { $in: ['insert','update','replace'] } } }];
    const cs = coll.watch(pipeline, { fullDocument: 'updateLookup' });
    // glog.log(`[spendWatcher] watching ${kind}…`);

    cs.on('change', async (chg) => {
      try {
        const doc = chg.fullDocument || {};

        // ✅ จุดที่ 2 (Change Stream): ถ้าคืนเงินไปแล้ว (refundCommitted: true) ให้หยุดทันที
        if (doc && doc.refundCommitted === true) {
          return; 
        }

        const uid =
          doc.userId || doc.user ||
          chg.updateDescription?.updatedFields?.userId ||
          chg.updateDescription?.updatedFields?.user;
        if (!uid) return;

        const orderId = doc?._id;

        if (chg.operationType === 'update') {
          const updated = Object.keys(chg.updateDescription?.updatedFields || {});
          const pickSet = (kind === 'orders') ? POKE_FIELDS : OTP24_POKE_FIELDS;
          const touched = updated.some(k => {
            const leaf = k.split('.').pop();
            return pickSet.has(k) || pickSet.has(leaf);
          });
          if (!touched) return;
        }

        (async () => {
          try {
            if (kind === 'orders') {
              const { reconcileOrderSpend } = await import('./spend.js');
              await reconcileOrderSpend(orderId);
            } else {
              const { reconcileOtp24OrderSpend } = await import('./spend.js');
              await reconcileOtp24OrderSpend(orderId);
            }
          } catch (e) {
            // glog.error(`[spendWatcher] reconcile ${kind} failed:`, e?.message || e);
          }
        })();

        scheduleUser(uid, async () => {
          try {
            const { recalcUserTotals } = await import('./spend.js');
            await recalcUserTotals(uid, { force: true, reason: `change_stream_${kind}` });
          } catch (e) {
            // glog.error('[spendWatcher] recalcUserTotals failed:', e?.message || e);
          }
        });
      } catch (e) {
        // glog.error('[spendWatcher] change handler error:', e?.message || e);
      }
    });

    cs.on('error', async (e) => {
      // glog.error(`[spendWatcher] stream error (${kind}):`, e?.message || e);
      try { cs.close(); } catch {}
      startPollingFallback(mongooseConn);
    });

    return cs;
  };

  try {
    const cs1 = startWatch(collOrders, 'orders');
    const cs2 = startWatch(collOtp24, 'otp24orders');
    return () => { try{ cs1?.close(); }catch{} try{ cs2?.close(); }catch{} };
  } catch (e) {
    // glog.error('[spendWatcher] watch init failed:', e?.message || e);
    return startPollingFallback(mongooseConn);
  }
}