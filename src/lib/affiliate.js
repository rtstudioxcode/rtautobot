// src/lib/affiliate.js — RTAUTOBOT Bonustime affiliate helpers
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { BonustimeOrder } from "../models/BonustimeOrder.js";

export const AFF_TIERS = Object.freeze([
  { rate: 5, refs: 0, earn: 0 },
  { rate: 6, refs: 10, earn: 0 },
  { rate: 8, refs: 20, earn: 3000 },
  { rate: 13, refs: 30, earn: 5000 },
  { rate: 23, refs: 50, earn: 10000 },
  { rate: 34, refs: 70, earn: 20000 },
  { rate: 40, refs: 100, earn: 50000 },
]);

const nz = (v) => (Number.isFinite(+v) ? +v : 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const toOid = (v) => mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null;

export function tierRateFor(refCount, earnTHB) {
  let best = AFF_TIERS[0].rate;
  for (const t of AFF_TIERS) {
    if (refCount >= t.refs && earnTHB >= t.earn) best = t.rate;
  }
  return Math.min(best, 40);
}

export async function getAffRateForUser(userId, { referredCount, earningsTHB } = {}) {
  const u = await User.findById(userId).select("affiliate").lean();
  const adminRate = Number(u?.affiliate?.ratePct ?? NaN);
  const tier = tierRateFor(
    Number(referredCount ?? u?.affiliate?.referredCount ?? 0),
    Number(earningsTHB ?? u?.affiliate?.earningsTHB ?? 0)
  );
  return Math.max(Number.isFinite(adminRate) ? adminRate : 0, tier, 5) / 100;
}

async function bonustimeTotalsForUsers(userIds = []) {
  if (!userIds.length) return { orders: 0, spentTHB: 0, byUser: new Map() };
  const oidList = userIds.map(toOid).filter(Boolean);
  const strList = userIds.map(String);
  const rows = await BonustimeOrder.aggregate([
    { $match: { $or: [{ user: { $in: oidList } }, { userId: { $in: oidList } }, { user: { $in: strList } }, { userId: { $in: strList } }] } },
    { $group: { _id: { $ifNull: ["$user", "$userId"] }, orders: { $sum: 1 }, spentTHB: { $sum: "$amountTHB" } } },
  ]);
  const byUser = new Map();
  let orders = 0;
  let spentTHB = 0;
  for (const r of rows) {
    const key = String(r._id);
    const rec = { orders: nz(r.orders), spentTHB: round2(r.spentTHB) };
    byUser.set(key, rec);
    orders += rec.orders;
    spentTHB += rec.spentTHB;
  }
  return { orders, spentTHB: round2(spentTHB), byUser };
}

async function bonustimeAffiliateRewards(uid) {
  const oid = toOid(uid);
  if (!oid) return 0;
  const rows = await BonustimeOrder.aggregate([
    { $match: { referrer: oid } },
    { $group: { _id: null, reward: { $sum: "$affiliateRewardTHB" } } },
  ]);
  return round2(rows?.[0]?.reward || 0);
}

export async function computeAffiliateTotals(uid) {
  const me = await User.findById(uid).select("affiliate").lean();
  const referred = await User.find({ referredBy: uid }).select("_id username createdAt").lean();
  const refIds = referred.map((r) => r._id);
  const totals = await bonustimeTotalsForUsers(refIds);
  const btBonusTHB = await bonustimeAffiliateRewards(uid);

  const paidTHB = nz(me?.affiliate?.paidTHB);
  const refCount = referred.length;
  const tier = tierRateFor(refCount, totals.spentTHB);
  const adminRate = Number(me?.affiliate?.ratePct ?? NaN);
  const ratePct = Math.max(tier, Number.isFinite(adminRate) ? adminRate : 0, 5);
  const earnings = round2(totals.spentTHB * (ratePct / 100) + btBonusTHB);
  const withdrawableTHB = Math.max(0, round2(earnings - paidTHB));

  await User.updateOne({ _id: uid }, { $set: {
    "affiliate.referredCount": refCount,
    "affiliate.earningsTHB": earnings,
    "affiliate.btBonusTHB": btBonusTHB,
    "affiliate.lastCalcAt": new Date(),
  } });

  return {
    ratePct,
    referredCount: refCount,
    orders: totals.orders,
    spentTHB: totals.spentTHB,
    earningsTHB: earnings,
    paidTHB: round2(paidTHB),
    withdrawableTHB,
    bonusTHB: btBonusTHB,
  };
}

export const computeAffiliateStats = computeAffiliateTotals;

export async function computeAffiliateBreakdown(uid) {
  const referred = await User.find({ referredBy: uid }).select("_id username").lean();
  const totals = await bonustimeTotalsForUsers(referred.map((r) => r._id));
  return referred.map((r) => {
    const rec = totals.byUser.get(String(r._id)) || { orders: 0, spentTHB: 0 };
    return { userId: r._id, username: r.username, orders: rec.orders, spentTHB: rec.spentTHB };
  });
}
