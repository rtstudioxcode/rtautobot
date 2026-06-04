import { ensureInit } from '../../../lib/setup';
import { Transaction } from '../../../models/Transaction';
import ReportClient from '../report/ReportClient';

export const metadata = { title: 'Admin — เติมเงิน' };
export const dynamic = 'force-dynamic';

const METHOD_LABELS = {
  tw: 'TrueMoney Wallet', truewallet: 'TrueMoney Wallet', qr: 'PromptPay QR',
  kbank: 'กสิกรไทย', scb: 'ไทยพาณิชย์', admin: 'Admin', manual: 'เติมมือ',
};

const MONTHS_FULL_TH = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];

export default async function AdminTopupPage({ searchParams }) {
  await ensureInit();

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();

  const mode = (searchParams?.mode === 'year') ? 'year' : 'month';

  let monthStr, selectedYear;
  if (mode === 'year') {
    selectedYear = Number(searchParams?.year) || nowYear;
    monthStr = `${selectedYear}-01`;
  } else {
    const raw = searchParams?.month || '';
    monthStr = /^\d{4}-\d{2}$/.test(raw)
      ? raw
      : `${nowYear}-${String(nowMonth + 1).padStart(2, '0')}`;
    selectedYear = Number(monthStr.split('-')[0]);
  }

  const [yy, mm] = monthStr.split('-').map(Number);

  const selectedLabel = mode === 'year'
    ? `ปี ${selectedYear + 543}`
    : `${MONTHS_FULL_TH[mm - 1]} ${yy + 543}`;

  let transactions = [];
  let sumNoAdmin = 0;
  let countNoAdmin = 0;
  let methodTotals = [];
  let yearlyRows = [];

  if (mode === 'month') {
    const startDate = new Date(yy, mm - 1, 1);
    const endDate = new Date(yy, mm, 1);
    const dateFilter = { createdAt: { $gte: startDate, $lt: endDate } };
    // All statuses for the table so pending transactions can be approved/rejected
    const allMatch = { production: 'rtautobot', ...dateFilter };
    // Only completed for summary stats
    const completedMatch = { production: 'rtautobot', status: 'completed', ...dateFilter };

    const [txDocs, aggNoAdmin, aggMethod] = await Promise.all([
      Transaction.find(allMatch)
        .sort({ createdAt: -1 })
        .populate('userId', 'username email avatarUrl avatarVer')
        .lean(),
      Transaction.aggregate([
        { $match: { ...completedMatch, method: { $nin: ['admin', 'manual'] } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: completedMatch },
        { $group: { _id: '$method', sum: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    transactions = txDocs.map(tx => ({
      _id: String(tx._id),
      transactionId: tx.transactionId || '',
      createdAt: tx.createdAt?.toISOString() || '',
      username: tx.username || '',
      amount: tx.amount,
      method: tx.method || '',
      status: tx.status || '',
      senderNumber: tx.senderNumber || '',
      senderBank: tx.senderBank || '',
      senderLast6: tx.senderLast6 || '',
      userId: tx.userId ? {
        username: tx.userId.username || '',
        email: tx.userId.email || '',
        avatarUrl: tx.userId.avatarUrl || '',
        avatarVer: tx.userId.avatarVer || 0,
      } : null,
    }));

    sumNoAdmin = aggNoAdmin[0]?.total || 0;
    countNoAdmin = aggNoAdmin[0]?.count || 0;
    methodTotals = aggMethod
      .map(m => ({ method: m._id || '', label: METHOD_LABELS[m._id] || m._id || '—', count: m.count, sum: m.sum }))
      .sort((a, b) => b.sum - a.sum);

  } else {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear + 1, 0, 1);
    const completedMatch = { production: 'rtautobot', status: 'completed', createdAt: { $gte: startDate, $lt: endDate } };

    const [aggYear, aggNoAdmin, aggMethodYear] = await Promise.all([
      Transaction.aggregate([
        { $match: completedMatch },
        { $group: {
          _id: { month: { $month: '$createdAt' } },
          sum: { $sum: '$amount' },
          count: { $sum: 1 },
          noAdminSum: { $sum: { $cond: [{ $in: ['$method', ['admin', 'manual']] }, 0, '$amount'] } },
          noAdminCount: { $sum: { $cond: [{ $in: ['$method', ['admin', 'manual']] }, 0, 1] } },
        } },
      ]),
      Transaction.aggregate([
        { $match: { ...completedMatch, method: { $nin: ['admin', 'manual'] } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: completedMatch },
        { $group: { _id: { month: { $month: '$createdAt' }, method: '$method' }, sum: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const monthMap = {};
    aggYear.forEach(r => {
      monthMap[r._id.month] = { sum: r.sum, count: r.count, noAdminSum: r.noAdminSum, noAdminCount: r.noAdminCount, methods: [] };
    });
    aggMethodYear.forEach(r => {
      const mo = r._id.month;
      if (!monthMap[mo]) monthMap[mo] = { sum: 0, count: 0, noAdminSum: 0, noAdminCount: 0, methods: [] };
      monthMap[mo].methods.push({ method: r._id.method, label: METHOD_LABELS[r._id.method] || r._id.method || '—', count: r.count, sum: r.sum });
    });

    yearlyRows = Array.from({ length: 12 }, (_, i) => {
      const mo = i + 1;
      const d = monthMap[mo] || { sum: 0, count: 0, noAdminSum: 0, noAdminCount: 0, methods: [] };
      return {
        month: `${selectedYear}-${String(mo).padStart(2, '0')}`,
        label: `${MONTHS_FULL_TH[i]} ${selectedYear + 543}`,
        sum: d.sum, count: d.count, noAdminSum: d.noAdminSum, noAdminCount: d.noAdminCount,
        methods: (d.methods || []).sort((a, b) => b.sum - a.sum),
      };
    });

    sumNoAdmin = aggNoAdmin[0]?.total || 0;
    countNoAdmin = aggNoAdmin[0]?.count || 0;
  }

  return (
    <ReportClient
      mode={mode}
      monthStr={monthStr}
      selectedYear={selectedYear}
      selectedLabel={selectedLabel}
      sumNoAdmin={sumNoAdmin}
      countNoAdmin={countNoAdmin}
      methodTotals={methodTotals}
      transactions={transactions}
      yearlyRows={yearlyRows}
    />
  );
}
