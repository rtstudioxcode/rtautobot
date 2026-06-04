export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session';
import { ensureInit } from '../../../../../lib/setup';
import { Topup } from '../../../../../models/Topup';

const PRODUCTION_KEY = 'rtautobot';

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { allowed: false, status: 403 };
  return { allowed: true };
}

const TOGGLE_FIELDS = new Set(['isActive', 'isSMS', 'isAuto']);

export async function POST(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });
    await ensureInit();

    const { id, field, value } = await request.json();
    if (!id || !field || !TOGGLE_FIELDS.has(field)) {
      return NextResponse.json({ ok: false, message: 'Invalid params' }, { status: 400 });
    }

    const wallet = await Topup.findOneAndUpdate(
      { _id: id, production: PRODUCTION_KEY },
      { $set: { [field]: !!value } },
      { new: true }
    ).lean();

    if (!wallet) return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, wallet });
  } catch (e: any) {
    console.error('POST /api/admin/wallet/update-toggle', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
