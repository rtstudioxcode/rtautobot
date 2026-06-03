import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { Transaction } from '../../../../models/Transaction.js';
import { User } from '../../../../models/User.js';

const PRODUCTION_KEY = 'rtautobot';
const VALID_METHODS = new Set(['tw', 'scb', 'kbank', 'qr', 'manual', 'admin']);

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { session, allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { session, allowed: false, status: 403 };
  return { session, allowed: true };
}

export async function POST(request) {
  try {
    const { allowed, status, session } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });
    await ensureInit();

    const { username, amount, method = 'admin', txId } = await request.json();
    const n = Number(amount);
    if (!username || !Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ ok: false, error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const m = VALID_METHODS.has(method) ? method : 'admin';

    const u = await User.findOne({ username });
    if (!u) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้' }, { status: 404 });

    const newBalance = await u.addBalance(n);

    if (session?.user && String(session.user._id) === String(u._id)) {
      session.user.balance = newBalance;
      await session.save();
    }

    if (txId) {
      // Approve an existing pending transaction
      const updated = await Transaction.findOneAndUpdate(
        { transactionId: txId, status: 'pending' },
        { $set: { status: 'completed', paidAt: new Date(), note: `approved by ${session.user.username}` } },
        { new: true }
      );
      if (!updated) {
        // Already processed or not found — still credit is done, just log
        console.warn('manual-topup: pending tx not found for txId', txId);
      }
    } else {
      await Transaction.create({
        production: PRODUCTION_KEY,
        userId: u._id,
        username: u.username,
        method: m,
        amount: n,
        amountCents: Math.round(n * 100),
        status: 'completed',
        paidAt: new Date(),
        note: `admin manual topup by ${session.user.username}`,
      });
    }

    return NextResponse.json({ ok: true, userId: String(u._id), username: u.username, balance: newBalance });
  } catch (e) {
    console.error('POST /api/admin/manual-topup', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
