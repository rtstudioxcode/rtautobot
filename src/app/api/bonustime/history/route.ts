export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { User } from '../../../../models/User';
import { BonustimeUser } from '../../../../models/BonustimeUser';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const user = await User.findById(session.user._id).select('serial_key').lean();
    const mySerial = user?.serial_key;

    if (!mySerial) return NextResponse.json({ ok: true, records: [] });

    const records = await BonustimeUser.find({ serial_key: mySerial })
      .sort({ serviceGroup: 1, serviceNo: 1, tenantId: 1 })
      .lean();

    return NextResponse.json({ ok: true, records });
  } catch (e: any) {
    console.error('GET /api/bonustime/history', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
