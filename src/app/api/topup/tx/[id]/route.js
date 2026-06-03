import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session.js';
import { ensureInit } from '../../../../../lib/setup.js';
import { Transaction } from '../../../../../models/Transaction.js';

const PRODUCTION_KEY = 'rtautobot';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { id } = await params;
    const tx = await Transaction.findOne({
      production: PRODUCTION_KEY,
      _id: id,
      userId: session.user._id,
    }).lean();

    if (!tx) return NextResponse.json({ ok: false }, { status: 404 });

    const response = NextResponse.json({
      ok: true,
      status: tx.status,
      method: tx.method,
      amount: tx.amount,
      displayAmount: tx.expectedAmount || tx.amount,
      paidAt: tx.paidAt || null,
      expiresAt: tx.expiresAt || null,
      expiresIn: tx.expiresAt ? Math.max(0, Math.ceil((new Date(tx.expiresAt).getTime() - Date.now()) / 1000)) : null,
      expired: tx.expiresAt ? new Date(tx.expiresAt).getTime() <= Date.now() : false,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
