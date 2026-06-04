export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session';
import { ensureInit } from '../../../../../lib/setup';
import { User } from '../../../../../models/User';
import { Transaction } from '../../../../../models/Transaction';
import { recalcUserTotals } from '../../../../../services/spend';

const MIN_POINTS = 100;
const PRODUCTION_KEY = 'rtautobot';

const round2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const positive = (n: any) => Math.max(0, round2(n));

export async function POST() {
  try {
    const session = await getSession();
    if (!session.user?._id) {
      return NextResponse.json({ ok: false, error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    await ensureInit();

    // รีคำนวณก่อนเสมอ เพื่อกันค่า points / rate ค้างจากข้อมูลเก่า
    await recalcUserTotals(session.user._id, { force: true });

    const before = await User.findById(session.user._id)
      .select('username balance points pointRateTHB pointValueTHB')
      .lean();

    if (!before) {
      return NextResponse.json({ ok: false, error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
    }

    const points = positive(before.points);
    const rate = positive(before.pointRateTHB);

    if (points < MIN_POINTS) {
      return NextResponse.json({
        ok: false,
        error: `ต้องมีอย่างน้อย ${MIN_POINTS.toLocaleString('th-TH')} แต้มก่อนแลกเครดิต`,
      }, { status: 400 });
    }

    if (rate <= 0) {
      return NextResponse.json({ ok: false, error: 'เลเวลปัจจุบันยังไม่มีเรทสำหรับแลกแต้ม' }, { status: 400 });
    }

    const redeemPoints = points;
    const creditAmount = positive(redeemPoints * rate);

    if (creditAmount <= 0) {
      return NextResponse.json({ ok: false, error: 'ยอดแลกเครดิตไม่ถูกต้อง' }, { status: 400 });
    }

    const updated = await User.findOneAndUpdate(
      { _id: session.user._id, points: { $gte: redeemPoints } },
      {
        $inc: {
          balance: creditAmount,
          pointsRedeemed: redeemPoints,
          redeemedSpent: creditAmount,
        },
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ ok: false, error: 'แต้มไม่พอหรือรายการนี้ถูกประมวลผลไปแล้ว กรุณารีเฟรชหน้า' }, { status: 409 });
    }

    await Transaction.create({
      production: PRODUCTION_KEY,
      userId: updated._id,
      username: updated.username,
      method: 'admin',
      amount: creditAmount,
      amountCents: Math.round(creditAmount * 100),
      status: 'completed',
      paidAt: new Date(),
      note: `redeem ${redeemPoints} points to balance`,
    });

    await recalcUserTotals(updated._id, { force: true });

    const fresh = await User.findById(updated._id)
      .select('username email emailVerified role name balance currency avatarUrl serial_key affiliateKey level levelIndex levelName levelNeed nextLevelName toNextLevel totalSpent totalSpentRaw btSpent redeemedSpent points pointsAccrued pointsRedeemed pointRateTHB pointValueTHB affiliate totalOrders')
      .lean();

    if (fresh) {
      session.user.balance = Number((fresh as any).balance || 0);
      session.user.level = (fresh as any).level;
      session.user.levelName = (fresh as any).levelName;
      await session.save();
    }

    return NextResponse.json({
      ok: true,
      message: `แลก ${redeemPoints.toLocaleString('th-TH', { maximumFractionDigits: 2 })} แต้ม เป็นเครดิต ฿${creditAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} สำเร็จ`,
      redeemedPoints: redeemPoints,
      creditAmount,
      balance: Number((fresh as any)?.balance ?? updated.balance ?? 0),
      user: fresh,
    });
  } catch (e: any) {
    console.error('POST /api/account/points/redeem', e);
    return NextResponse.json({ ok: false, error: e?.message || 'แลกแต้มไม่สำเร็จ' }, { status: 500 });
  }
}
