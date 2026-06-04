export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { ensureInit } from '../../../../lib/setup';
import { Topup } from '../../../../models/Topup';
import { Transaction } from '../../../../models/Transaction';
import { User } from '../../../../models/User';

export const runtime = 'nodejs';

const PRODUCTION_KEY = 'rtautobot';
const BANGKOK_OFFSET_MIN = 7 * 60;

function makeBangkokDate(year, month, day, hour, minute, second = 0) {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utcMs - BANGKOK_OFFSET_MIN * 60 * 1000);
}

function payloadToObject(input) {
  if (!input) return {};
  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...parsed, __rawText: raw };
    } catch {}
    return { message: raw, text: raw, __rawText: raw };
  }
  if (typeof input === 'object') return input;
  return {};
}

function buildPendingTopupMatchFilter(method, amountCents) {
  return {
    production: PRODUCTION_KEY,
    method,
    amountCents,
    status: 'pending',
    $or: [
      { userId: { $exists: true, $ne: null } },
      {
        $and: [
          { $or: [{ userId: { $exists: false } }, { userId: null }] },
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }] },
        ],
      },
    ],
  };
}

async function cleanupExpiredOrphans() {
  await Transaction.updateMany(
    {
      production: PRODUCTION_KEY,
      status: 'processing',
      expiresAt: { $lte: new Date() },
      $or: [{ userId: { $exists: false } }, { userId: null }],
    },
    { $set: { status: 'failed', note: 'expired processing orphan topup' } }
  );
}

export async function POST(request) {
  try {
    await ensureInit();

    const text = await request.text();
    let rawBody = {};
    try { rawBody = JSON.parse(text); } catch { rawBody = { message: text, __rawText: text }; }

    const payload = payloadToObject(rawBody);
    const message = String(payload.message || payload.text || payload.body || payload.sms || payload.__rawText || '').trim();
    const secret = String(payload.secret || payload.webhookSecret || payload.key || request.headers.get('x-webhook-secret') || '').trim();
    const timestamp = Number(payload.timestamp || payload.ts || 0);

    if (!message) return NextResponse.json({ success: false, message: 'message required' }, { status: 400 });

    const topup = await Topup.findOne({ production: PRODUCTION_KEY, accountCode: 'kbank', isActive: true }).lean();
    if (!topup || secret !== String(topup.secret).trim())
      return NextResponse.json({ success: false, message: 'invalid secret' }, { status: 401 });

    if (timestamp && Math.abs(Date.now() - timestamp * 1000) > 10 * 60 * 1000)
      return NextResponse.json({ success: false, message: 'invalid timestamp' }, { status: 400 });

    const regex = /(\d{2})\/(\d{2})(?:\/(\d{2}))?\s+(\d{2}):(\d{2})\s+บช\s+X-(\d+)\s+(?:รับโอนจาก\s+X-(\d+)\s+)?(?:เงินเข้า|รับโอนจาก\s+X-\d+)\s+([\d,]+\.\d{2})/i;
    const match = String(message).match(regex);
    if (!match) return NextResponse.json({ success: false }, { status: 400 });

    const [, day, month, year2, hour, minute, receiverDigits, senderDigits, amountStr] = match;

    if (topup.accountNumber && receiverDigits && !topup.accountNumber.endsWith(receiverDigits))
      return NextResponse.json({ success: false }, { status: 403 });

    const amt = Number(amountStr.replace(/,/g, '')) || 0;
    const amtCents = Math.round(amt * 100);
    const year = year2 ? 2000 + Number(year2) : new Date().getFullYear();
    const seconds = timestamp ? new Date(timestamp * 1000).getSeconds() : new Date().getSeconds();
    const parsedDate = makeBangkokDate(year, Number(month), Number(day), Number(hour), Number(minute), seconds);

    const dup = await Transaction.findOne({
      production: PRODUCTION_KEY,
      method: 'kbank',
      amountCents: amtCents,
      status: 'completed',
      occurredAt: { $gte: new Date(parsedDate.getTime() - 2 * 60 * 1000), $lte: new Date(parsedDate.getTime() + 2 * 60 * 1000) },
    }).lean();

    if (dup) return NextResponse.json({ success: true, deduped: true });

    await cleanupExpiredOrphans();

    const pendingTx = await Transaction.findOneAndUpdate(
      buildPendingTopupMatchFilter('kbank', amtCents),
      { $set: { status: 'processing' } },
      { sort: { createdAt: -1 }, new: true }
    );

    if (!pendingTx) {
      await Transaction.create({
        production: PRODUCTION_KEY,
        method: 'kbank',
        amount: amt,
        amountCents: amtCents,
        status: 'pending',
        senderLast6: senderDigits?.slice(-6),
        receiverLast6: receiverDigits?.slice(-6),
        occurredAt: parsedDate,
        note: 'unmatched by amount',
      });
      return NextResponse.json({ success: true, unmatched: true });
    }

    const user = await User.findById(pendingTx.userId);
    if (!user) return NextResponse.json({ success: true });

    const creditAmount = Number(pendingTx.amount || 0);
    const newBalance = await user.addBalance(creditAmount);

    pendingTx.set({
      status: 'completed',
      matchedBy: 'amountCents',
      senderLast6: senderDigits?.slice(-6),
      receiverLast6: receiverDigits?.slice(-6),
      occurredAt: parsedDate,
      paidAt: new Date(),
      note: 'matched kbank',
    });
    await pendingTx.save();

    return NextResponse.json({ success: true, amount: creditAmount, paidAmount: amt, balance: newBalance });
  } catch (e: any) {
    console.error('KBANK WEBHOOK ERROR', e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
