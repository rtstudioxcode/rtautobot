import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { ensureInit } from '../../../../lib/setup.js';
import { BonustimeUser } from '../../../../models/BonustimeUser.js';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const { searchParams } = new URL(request.url);
    const wantLotto = searchParams.get('type') === 'lotto';

    const item = await BonustimeUser.findOne({
      $or: [{ serial_key: null }, { serial_key: '' }],
      LOTTO_ENABLED: wantLotto ? true : { $ne: true },
    })
      .collation({ locale: 'en', numericOrdering: true })
      .sort({ tenantId: 1, _id: 1 })
      .lean();

    if (!item) return NextResponse.json({ ok: false, message: 'แพ็กเกจนี้สินค้าหมดแล้ว' });

    return NextResponse.json({ ok: true, item: { _id: item._id, tenantId: item.tenantId } });
  } catch (e) {
    console.error('GET /api/bonustime/next', e);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
