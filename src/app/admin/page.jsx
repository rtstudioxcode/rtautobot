import { ensureInit } from '../../lib/setup.js';
import { User } from '../../models/User.js';
import { BonustimeOrder } from '../../models/BonustimeOrder.js';
import { Transaction } from '../../models/Transaction.js';
import { BonustimeUser } from '../../models/BonustimeUser.js';
import { Topup } from '../../models/Topup.js';
import AdminDashboardClient from './AdminDashboardClient.jsx';

export const metadata = { title: 'Admin — ภาพรวม' };
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

function calcBonustimeExpiry(doc) {
  const m = String(doc?.LICENSE_START_DATE || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;

  const year = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]);
  const start = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1]), 0, 0, 0));
  if (!Number.isFinite(start.getTime())) return null;

  const durationDays = Number(doc?.LICENSE_DURATION_DAYS || 0);
  if (!Number.isFinite(durationDays) || durationDays <= 0) return null;

  return new Date(start.getTime() + durationDays * DAY_MS);
}

function isActiveNonPermanentBonustimeService(doc, now = new Date()) {
  if (!doc?.serial_key) return false;
  if (doc.LICENSE_DISABLED === true) return false;

  const expiry = calcBonustimeExpiry(doc);
  if (!expiry) return false;

  return expiry.getTime() > now.getTime();
}

export default async function AdminPage() {
  await ensureInit();

  const [
    bonustimeOrderCount,
    bonustimeRevenuArr,
    topupCount,
    topupSumArr,
    pendingCount,
    pendingTotalArr,
    activeServices,
    walletCount,
    pendingTxs,
  ] = await Promise.all([
    BonustimeOrder.countDocuments(),
    BonustimeOrder.aggregate([{ $group: { _id: null, total: { $sum: '$amountTHB' } } }]),
    Transaction.countDocuments({ status: 'completed', production: 'rtautobot' }),
    Transaction.aggregate([{ $match: { status: 'completed', production: 'rtautobot' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.countDocuments({ status: 'pending', production: 'rtautobot' }),
    Transaction.aggregate([{ $match: { status: 'pending', production: 'rtautobot' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    BonustimeUser.find({
      serial_key: { $exists: true, $ne: '' },
      LICENSE_DISABLED: { $ne: true },
      LICENSE_DURATION_DAYS: { $gt: 0 },
    })
      .select('serial_key LICENSE_START_DATE LICENSE_DURATION_DAYS LICENSE_DISABLED')
      .lean(),
    Topup.countDocuments({ production: 'rtautobot', isActive: true, accountCode: { $in: ['tw', 'kbank', 'scb', 'qr'] } }),
    Transaction.find({ status: 'pending', production: 'rtautobot' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'username email avatarUrl')
      .lean(),
  ]);

  const activeServiceCount = activeServices.filter((svc) => isActiveNonPermanentBonustimeService(svc)).length;

  const stats = {
    bonustimeOrderCount,
    bonustimeRevenue: bonustimeRevenuArr[0]?.total || 0,
    topupCount,
    topupSum: topupSumArr[0]?.total || 0,
    pendingCount,
    pendingTotal: pendingTotalArr[0]?.total || 0,
    // Real active paid services: not expired and not permanent.
    activeServiceCount,
    activeNonPermanentServiceCount: activeServiceCount,
    activeServiceCountReal: activeServiceCount,
    walletCount,
  };

  const pendingList = pendingTxs.map(tx => ({
    _id: String(tx._id),
    transactionId: tx.transactionId || '',
    createdAt: tx.createdAt?.toISOString() || new Date().toISOString(),
    username: tx.username || '',
    amount: tx.amount,
    method: tx.method,
    userId: tx.userId ? {
      username: tx.userId.username || '',
      email: tx.userId.email || '',
      avatarUrl: tx.userId.avatarUrl || '',
    } : null,
  }));

  return <AdminDashboardClient stats={stats} pendingList={pendingList} />;
}
