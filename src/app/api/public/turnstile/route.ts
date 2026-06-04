export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { ensureInit } from '../../../../lib/setup';
import { getTurnstilePublicConfig } from '../../../../lib/turnstile';

export async function GET() {
  try {
    await ensureInit();
    const cfg = getTurnstilePublicConfig();
    return NextResponse.json({
      ok: true,
      enabled: cfg.enabled,
      siteKey: cfg.siteKey,
    });
  } catch (err) {
    console.error('GET /api/public/turnstile', err);
    return NextResponse.json({ ok: true, enabled: false, siteKey: '' });
  }
}
