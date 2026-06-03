import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/session.js';
import { ensureInit } from '../../../../../lib/setup.js';
import { Transaction } from '../../../../../models/Transaction.js';

const PRODUCTION_KEY = 'rtautobot';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session.user?._id) return NextResponse.json({ ok: false, message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    await ensureInit();

    const { id } = await params;
    const tx = await Transaction.findOne({
      production: PRODUCTION_KEY,
      _id: id,
      userId: session.user._id,
      status: 'pending',
    });

    if (!tx) return NextResponse.json({ ok: false, message: 'ไม่พบรายการที่รอยกเลิก' }, { status: 404 });

    const expired = tx.expiresAt ? new Date(tx.expiresAt).getTime() <= Date.now() : false;
    if (!expired)
      return NextResponse.json({ ok: false, message: 'รายการนี้ยังไม่หมดเวลา กรุณารอให้หมดเวลาก่อน' }, { status: 400 });

    tx.set({
      status: 'cancelled',
      canceledAt: new Date(),
      note: `${tx.method || 'topup'}_topup_cancelled_by_user_after_expired`,
    });
    await tx.save();

    return NextResponse.json({ ok: true, cancelled: true });
  } catch (e) {
    console.error('CANCEL TOPUP ERROR', e);
    return NextResponse.json({ ok: false, message: 'ยกเลิกรายการไม่สำเร็จ' }, { status: 500 });
  }
}
