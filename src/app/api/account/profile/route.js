import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { User } from '../../../../models/User.js';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });
    await ensureInit();
    const user = await User.findById(session.user._id)
      .select('username email emailVerified role name balance currency avatarUrl serial_key affiliateKey level levelIndex levelName levelNeed nextLevelName toNextLevel totalSpent totalSpentRaw btSpent redeemedSpent points pointsAccrued pointsRedeemed pointRateTHB pointValueTHB affiliate totalOrders')
      .lean();
    if (!user) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    console.error('GET /api/account/profile', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const body = await request.json();
    const fullName = String(body.name || '').trim();
    const emailInput = String(body.email || '').trim().toLowerCase();

    const u = await User.findById(session.user._id);
    if (!u) return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });

    let changed = false;

    if (fullName && fullName !== u.name) {
      u.name = fullName;
      changed = true;
    }

    if (emailInput && !u.email) {
      u.email = emailInput;
      u.emailVerified = false;
      changed = true;
    }

    if (changed) await u.save();

    // Sync session
    if (fullName) session.user.name = u.name;
    if (emailInput && !session.user.email) session.user.email = u.email;
    await session.save();

    return NextResponse.json({
      ok: true,
      user: { name: u.name, email: u.email, emailVerified: !!u.emailVerified },
    });
  } catch (e) {
    console.error('POST /api/account/profile', e);
    return NextResponse.json({ ok: false, error: 'update failed' }, { status: 500 });
  }
}
