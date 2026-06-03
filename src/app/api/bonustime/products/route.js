import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { BonustimeUser } from '../../../../models/BonustimeUser.js';

const BT_PACKAGES = {
  normal: { days: 30, price: 2000, label: 'แพ็กเกจ 1 : สล็อต + บาคาร่า' },
  lotto: { days: 30, price: 2500, label: 'แพ็กเกจ 2 : สล็อต + บาคาร่า + หวย' },
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const baseFilter = { $or: [{ serial_key: null }, { serial_key: '' }] };
    const [normalCount, lottoCount] = await Promise.all([
      BonustimeUser.countDocuments({ ...baseFilter, LOTTO_ENABLED: { $ne: true } }),
      BonustimeUser.countDocuments({ ...baseFilter, LOTTO_ENABLED: true }),
    ]);

    return NextResponse.json({
      ok: true,
      packages: {
        normal: { count: normalCount, ...BT_PACKAGES.normal },
        lotto: { count: lottoCount, ...BT_PACKAGES.lotto },
      },
    });
  } catch (e) {
    console.error('GET /api/bonustime/products', e);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
