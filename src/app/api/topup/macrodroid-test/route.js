export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ensureInit } from '../../../../lib/setup.js';

export const runtime = 'nodejs';

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function parseNotificationAmount(text = '') {
  const raw = String(text || '');
  const patterns = [
    /(?:ยอดเงินจำนวน|จำนวน|ฝาก|รับโอน|เงินเข้า|โอนเข้า|ได้รับเงิน|เข้า)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)\s*(?:บาท|บ\.?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)\s*(?:บาท|บ\.?)/i,
  ];
  for (const rx of patterns) {
    const m = raw.match(rx);
    if (!m) continue;
    const n = Number(String(m[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export async function POST(request) {
  try {
    await ensureInit();

    const text = await request.text();
    let payload = {};
    try { payload = JSON.parse(text); } catch { payload = { message: text, __rawText: text }; }

    const notificationText = firstNonEmpty(
      payload.notification_text, payload.notificationText, payload.text,
      payload.message, payload.notification, payload.bigText,
      payload.notification_big_text, payload.__rawText
    );
    const title = firstNonEmpty(
      payload.notification_title, payload.notificationTitle, payload.title, payload.not_title, payload.app
    );
    const appName = firstNonEmpty(
      payload.notification_app_name, payload.notificationAppName, payload.appName, payload.packageName, payload.source
    );
    const combinedText = [title, notificationText].filter(Boolean).join('\n');
    const amount = parseNotificationAmount(combinedText);
    const device = firstNonEmpty(payload.device, payload.deviceId, payload.phone, payload.phoneName);
    const eventTimeText = firstNonEmpty(payload.time, payload.system_time, payload.notification_time, payload.receivedAt);
    const now = new Date();

    const doc = {
      provider: 'macrodroid-test',
      source: firstNonEmpty(appName, payload.source, 'unknown'),
      channel: firstNonEmpty(payload.channel, 'notification'),
      title,
      text: notificationText,
      combinedText,
      amount,
      device,
      eventTimeText,
      rawBody: payload,
      meta: {
        ip: request.headers.get('x-forwarded-for')?.split(',')[0] || '',
        userAgent: request.headers.get('user-agent') || '',
        contentType: request.headers.get('content-type') || '',
      },
      used: false,
      processed: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await mongoose.connection.collection('macrodroid_test_inbox').insertOne(doc);

    return NextResponse.json({
      success: true,
      stored: true,
      collection: 'macrodroid_test_inbox',
      id: String(result.insertedId),
      parsed: { source: doc.source, title: doc.title, text: doc.text, amount: doc.amount },
    });
  } catch (e) {
    console.error('MACRODROID TEST WEBHOOK ERROR', e);
    return NextResponse.json({ success: false, message: 'server error' }, { status: 500 });
  }
}
