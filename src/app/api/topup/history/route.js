import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { Transaction } from '../../../../models/Transaction.js';

const PRODUCTION_KEY = 'rtautobot';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const transactions = await Transaction.find({
      userId: session.user._id,
      production: PRODUCTION_KEY,
    })
      .sort({ _id: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({ ok: true, transactions });
  } catch (e) {
    console.error('GET /api/topup/history', e);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
