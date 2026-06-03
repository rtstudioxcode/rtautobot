import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { Topup } from '../../../../models/Topup.js';

const PRODUCTION_KEY = 'rtautobot';

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { allowed: false, status: 403 };
  return { allowed: true };
}

export async function GET() {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });
    await ensureInit();
    const wallets = await Topup.find({ production: PRODUCTION_KEY }).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ ok: true, wallets, canWrite: true });
  } catch (e) {
    console.error('GET /api/admin/wallets', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });
    await ensureInit();

    const { wallets = [], newWallet } = await request.json();

    for (const w of wallets) {
      if (!w._id) continue;
      await Topup.findOneAndUpdate({ _id: w._id, production: PRODUCTION_KEY }, {
        $set: {
          accountName:   w.accountName   ?? '',
          accountNumber: w.accountNumber ?? '',
          secret:        w.secret        ?? '',
          isActive: !!w.isActive,
          isSMS:    !!w.isSMS,
          isAuto:   !!w.isAuto,
        },
      });
    }

    if (newWallet?.accountCode) {
      await Topup.create({
        production: PRODUCTION_KEY,
        accountName:   newWallet.accountName   || '',
        accountNumber: newWallet.accountNumber || '',
        accountCode:   String(newWallet.accountCode || '').toLowerCase(),
        type:          newWallet.type === 'WITHDRAW' ? 'WITHDRAW' : 'DEPOSIT',
        isActive: !!newWallet.isActive,
        isSMS:    !!newWallet.isSMS,
        isAuto:   !!newWallet.isAuto,
        secret:   newWallet.secret || '',
      });
    }

    const updated = await Topup.find({ production: PRODUCTION_KEY }).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ ok: true, wallets: updated });
  } catch (e) {
    console.error('POST /api/admin/wallets', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
