export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/session';
import { ensureInit } from '../../../lib/setup';
import { User } from '../../../models/User';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const u = await User.findById(session.user._id).select('balance currency').lean();
    return NextResponse.json({ ok: true, balance: u?.balance || 0, currency: u?.currency || 'THB' });
  } catch (e: any) {
    console.error('GET /api/wallet', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });
    if (session.user.role !== 'admin') return NextResponse.json({ ok: false }, { status: 403 });

    await ensureInit();

    const { userId, amount } = await request.json();
    const u = await User.findById(userId);
    if (!u) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้' }, { status: 404 });

    const n = Number(amount || 0);
    if (!Number.isFinite(n)) return NextResponse.json({ ok: false, error: 'ยอดไม่ถูกต้อง' }, { status: 400 });

    const balance = await u.addBalance(n);
    return NextResponse.json({ ok: true, balance, currency: u.currency });
  } catch (e: any) {
    console.error('POST /api/wallet', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
