import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { Transaction } from '../../../../models/Transaction.js';
import { Topup } from '../../../../models/Topup.js';
import { User } from '../../../../models/User.js';

const PRODUCTION_KEY = 'rtautobot';

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { session, allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { session, allowed: false, status: 403 };
  return { session, allowed: true };
}

export async function GET(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20', 10)));

    const query = { production: PRODUCTION_KEY };
    if (filter !== 'all') query.status = filter;

    const [total, transactions] = await Promise.all([
      Transaction.countDocuments(query),
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate({ path: 'userId', select: 'username avatarUrl email' })
        .lean(),
    ]);

    return NextResponse.json({ ok: true, total, page, perPage, transactions });
  } catch (e) {
    console.error('GET /api/admin/topup', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { allowed, status, session } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const body = await request.json();
    const action = body.action;

    if (action === 'manual-topup') {
      const { userId, amount, method = 'admin', note = '' } = body;
      const n = Number(amount);
      if (!userId || !Number.isFinite(n) || n <= 0)
        return NextResponse.json({ ok: false, error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

      const u = await User.findById(userId);
      if (!u) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้' }, { status: 404 });

      const newBalance = await u.addBalance(n);

      await Transaction.create({
        production: PRODUCTION_KEY,
        userId: u._id,
        method: method || 'admin',
        amount: n,
        amountCents: Math.round(n * 100),
        status: 'completed',
        paidAt: new Date(),
        note: note || `admin manual topup by ${session.user.username}`,
      });

      return NextResponse.json({ ok: true, balance: newBalance });
    }

    if (action === 'save-wallet') {
      const { accountCode, accountNumber, accountName, secret, isSMS = false, isActive = true } = body;
      if (!accountCode || !accountNumber)
        return NextResponse.json({ ok: false, error: 'ข้อมูลบัญชีไม่ครบ' }, { status: 400 });

      const existing = await Topup.findOne({ production: PRODUCTION_KEY, accountCode });
      if (existing) {
        existing.accountNumber = accountNumber;
        existing.accountName = accountName || '';
        if (secret) existing.secret = secret;
        existing.isSMS = !!isSMS;
        existing.isActive = !!isActive;
        await existing.save();
      } else {
        await Topup.create({ production: PRODUCTION_KEY, accountCode, accountNumber, accountName: accountName || '', secret: secret || '', isSMS: !!isSMS, isActive: !!isActive });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error('POST /api/admin/topup', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
