export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { AppConfig } from '../../../../models/AppConfig.js';
import { refreshConfigFromDB } from '../../../../config.js';

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
  } catch (e) {
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
  } catch (e) {
    console.error('POST /api/admin/config', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
