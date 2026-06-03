export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session.js';
import { ensureInit } from '../../../../../lib/setup.js';
import { Topup } from '../../../../../models/Topup.js';

const PRODUCTION_KEY = 'rtautobot';

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { allowed: false, status: 403 };
  return { allowed: true };
}

export async function DELETE(request, { params }) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });
    await ensureInit();
    await Topup.findOneAndDelete({ _id: params.id, production: PRODUCTION_KEY });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/wallets/[id]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
