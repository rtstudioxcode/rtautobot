export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';

const ALLOWED_ROLES = ['admin', 'user'];

async function requireAdmin() {
  const session = await getSession();
  if (!session.user?._id) return { session, allowed: false, status: 401 };
  if (session.user.role !== 'admin') return { session, allowed: false, status: 403 };
  return { session, allowed: true };
}

export async function GET(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20', 10)));
    const q = searchParams.get('q') || '';

    const filter = q
      ? { $or: [{ username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }] }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter, {
        username: 1, name: 1, role: 1, email: 1, emailVerified: 1,
        avatarUrl: 1, levelName: 1, balance: 1, totalSpent: 1,
        points: 1, totalOrders: 1, createdAt: 1, updatedAt: 1,
      }).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    ]);

    return NextResponse.json({ ok: true, total, page, perPage, users });
  } catch (e) {
    console.error('GET /api/admin/users', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { allowed, status } = await requireAdmin();
    if (!allowed) return NextResponse.json({ ok: false }, { status });

    await ensureInit();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });

    const { name, role, emailVerified, balance } = await request.json();
    const update = {};

    if (typeof name === 'string') update.name = name.trim().slice(0, 100);
    if (typeof role === 'string') {
      const r = role.trim().toLowerCase();
      if (!ALLOWED_ROLES.includes(r)) return NextResponse.json({ ok: false, error: 'role ไม่ถูกต้อง' }, { status: 400 });
      update.role = r;
    }
    if (typeof emailVerified !== 'undefined') update.emailVerified = !!emailVerified;
    if (typeof balance !== 'undefined') {
      const n = Number(balance);
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ ok: false, error: 'balance ไม่ถูกต้อง' }, { status: 400 });
      update.balance = Math.round(n * 100) / 100;
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ ok: false, error: 'ไม่มีฟิลด์ที่แก้ไขได้' }, { status: 400 });

    const user = await User.findByIdAndUpdate(id, { $set: update, $currentDate: { updatedAt: true } }, { new: true, runValidators: true }).lean();
    if (!user) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้' }, { status: 404 });

    const { passwordHash: _p, resetToken: _r, ...safeUser } = user;
    return NextResponse.json({ ok: true, user: safeUser });
  } catch (e) {
    console.error('PATCH /api/admin/users', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
