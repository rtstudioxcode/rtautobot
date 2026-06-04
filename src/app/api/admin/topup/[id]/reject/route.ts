export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../../lib/session';
import { ensureInit } from '../../../../../../lib/setup';
import { Transaction } from '../../../../../../models/Transaction';

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { allowed: false, status: 403 };
  return { allowed: true };
}

export async function POST(request, { params }) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });
    await ensureInit();

    const { id } = params;

    // Try by MongoDB _id first (24 hex chars), then by transactionId (ULID, 26 chars)
    let tx = null;
    if (/^[0-9a-f]{24}$/i.test(id)) {
      tx = await Transaction.findByIdAndUpdate(
        id,
        { $set: { status: 'reject' } },
        { new: true }
      );
    }
    if (!tx) {
      tx = await Transaction.findOneAndUpdate(
        { transactionId: id },
        { $set: { status: 'reject' } },
        { new: true }
      );
    }

    if (!tx) return NextResponse.json({ ok: false, error: 'ไม่พบรายการ' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/admin/topup/[id]/reject', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
