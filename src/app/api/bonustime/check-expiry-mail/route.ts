export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session';
import { ensureInit } from '../../../../lib/setup';
import { checkAndSendBonustimeExpiryMails } from '../../../../services/bonustimeExpiry';

export async function POST() {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false }, { status: 401 });

    await ensureInit();

    const result = await checkAndSendBonustimeExpiryMails({ logPrefix: '[BonustimeExpiryRoute]' });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('POST /api/bonustime/check-expiry-mail', e);
    return NextResponse.json({ ok: false, message: 'ไม่สามารถเช็กและส่งเมลแจ้งเตือนได้' }, { status: 500 });
  }
}
