// src/services/spend.js — RTAUTOBOT Bonustime spend calculation
import { User } from "../models/User.js";
import { BonustimeOrder } from "../models/BonustimeOrder.js";
import { LEVELS as LV_LOYALTY, getRateForLevelIndex as _getRate } from "./loyalty.js";

const nz = (v) => (Number.isFinite(+v) ? +v : 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const positive = (n) => Math.max(0, round2(n));

export const LEVELS = Object.freeze([
  { name: "เลเวล 1", need: 0 },
  { name: "เลเวล 2", need: 5_000 },
  { name: "เลเวล 3", need: 10_000 },
  { name: "เลเวล 4", need: 30_000 },
  { name: "เลเวล 5", need: 50_000 },
  { name: "Retail", need: 80_000 },
  { name: "Wholesale", need: 175_000 },
  { name: "Reseller", need: 700_000 },
  { name: "VIP", need: 1_000_000 },
  { name: "Legendary", need: 5_000_000 },
]);

const lastRunAt = new Map();
const COOLDOWN_MS = 5_000;

export function calcPoints(totalSpentEff = 0) {
  const spent = Math.max(0, Number(totalSpentEff) || 0);
  return positive(Math.floor(spent / 50) * 0.5);
}

export function computeLevel(total = 0) {
  const t = Math.max(0, Number(total) || 0);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (t >= LEVELS[i].need) idx = i;
    else break;
  }
  return String(Math.max(1, idx + 1));
}

export function decideLevel(total = 0) {
  const t = Math.max(0, Number(total) || 0);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (t >= LEVELS[i].need) idx = i;
    else break;
  }
  const lv = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  return {
    index: idx,
    name: lv.name,
    need: lv.need,
    nextName: next?.name || null,
    toNext: next ? Math.max(0, next.need - t) : 0,
  };
}

function getRateForLevelIndex(idx = 0) {
  if (typeof _getRate === "function") return _getRate(idx);
  const lv = LV_LOYALTY?.[idx];
  if (!lv?.rate) return 0;
  const n = Number(String(lv.rate).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function buildUserMatch(userId) {
  return { $or: [{ user: userId }, { userId }, { user: String(userId) }, { userId: String(userId) }] };
}

async function computeBonustimeSpent(userId) {
  const rows = await BonustimeOrder.find(buildUserMatch(userId), {
    amountTHB: 1,
    createdAt: 1,
    updatedAt: 1,
  }).lean();

  const total = positive(rows.reduce((sum, o) => sum + nz(o.amountTHB), 0));
  const lastPaidAt = rows.reduce((max, o) => {
    const t = +new Date(o.updatedAt || o.createdAt || 0);
    return Math.max(max, Number.isFinite(t) ? t : 0);
  }, 0);

  return {
    total,
    count: rows.length,
    lastPaidAt: lastPaidAt ? new Date(lastPaidAt) : new Date(),
  };
}

export async function recalcUserTotals(userId, opts = {}) {
  const { force = false } = opts;
  if (!userId) return { ok: false, error: "userId is required" };

  const uid = String(userId);
  const now = Date.now();
  const last = lastRunAt.get(uid) || 0;
  if (!force && now - last < COOLDOWN_MS) return { ok: true, skipped: true, reason: "cooldown" };
  lastRunAt.set(uid, now);

  const u = await User.findById(userId).select("redeemedSpent pointsRedeemed btSpent").lean();
  const bt = await computeBonustimeSpent(userId);

  // RTAUTOBOT ใช้ Bonustime เป็น source of truth หลักเท่านั้น
  // ไม่รวม SMM / OTP24 / APPS แล้ว เพื่อไม่ให้เว็บใหม่ปนยอดจากบริการเก่า
  const ledgerRaw = positive(bt.total || u?.btSpent || 0);
  const redeemedSpent = positive(u?.redeemedSpent);
  const effectiveSpent = positive(ledgerRaw - redeemedSpent);

  const lvMeta = decideLevel(effectiveSpent);
  const pointsAccrued = calcPoints(effectiveSpent);
  const pointsRedeemed = positive(u?.pointsRedeemed);
  const points = positive(pointsAccrued - pointsRedeemed);
  const pointRateTHB = getRateForLevelIndex(lvMeta.index);
  const pointValueTHB = round2(points * pointRateTHB);

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        btSpent: ledgerRaw,
        totalOrders: bt.count,
        totalOrdersPaid: bt.count,
        totalSpentRaw: ledgerRaw,
        totalSpent: effectiveSpent,
        level: String(lvMeta.index + 1),
        levelIndex: lvMeta.index,
        levelName: lvMeta.name,
        levelNeed: lvMeta.need,
        nextLevelName: lvMeta.nextName,
        toNextLevel: lvMeta.toNext,
        lastSpentAt: bt.lastPaidAt,
        points,
        pointsAccrued,
        pointRateTHB,
        pointValueTHB,
      },
    }
  );

  return {
    ok: true,
    sourceSpent: { bonustime: ledgerRaw, total: ledgerRaw },
    totalOrders: bt.count,
    totalOrdersPaid: bt.count,
    totalSpentRaw: ledgerRaw,
    totalSpent: effectiveSpent,
    redeemedSpent,
    level: String(lvMeta.index + 1),
    levelInfo: lvMeta,
    points,
    pointsAccrued,
    pointsRedeemed,
    pointRateTHB,
    pointValueTHB,
  };
}

// Compatibility exports: old RTSMM services may import these names, but RTAUTOBOT no longer runs them.
export async function reconcileUserByOrderEvent() { return { ok: true, skipped: true, reason: "rtautobot_bonustime_only" }; }
export async function reconcileOrderSpend() { return { ok: true, skipped: true, reason: "rtautobot_bonustime_only" }; }
export async function reconcileOtp24OrderSpend() { return { ok: true, skipped: true, reason: "rtautobot_bonustime_only" }; }
export async function reconcileAppsOrderSpend() { return { ok: true, skipped: true, reason: "rtautobot_bonustime_only" }; }
export async function recalcAllUsersTotals() { return { ok: true, skipped: true, reason: "rtautobot_bonustime_only" }; }
