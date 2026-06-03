import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { Topup } from '../../../../models/Topup.js';

const PRODUCTION_KEY = 'rtautobot';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const wallets = await Topup.find({
      production: PRODUCTION_KEY,
      isActive: true,
      accountCode: { $in: ['tw', 'kbank', 'scb', 'qr'] },
    }).lean();

    return NextResponse.json({ ok: true, wallets });
  } catch (e) {
    console.error('GET /api/topup/wallets', e);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
