export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { AppConfig } from '../../../../models/AppConfig';
import { refreshConfigFromDB } from '../../../../config';

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

    const docs = await AppConfig.find({}).lean();
    const config = {};
    for (const d of docs) config[d.key] = d.value;

    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    console.error('GET /api/admin/config', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const body = await request.json();
    const { key, value, secret = false } = body;

    if (!key) return NextResponse.json({ ok: false, error: 'Missing key' }, { status: 400 });

    await AppConfig.findOneAndUpdate(
      { key },
      { $set: { key, value, secret: !!secret } },
      { upsert: true, new: true }
    );

    try { await refreshConfigFromDB(); } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/admin/config', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
