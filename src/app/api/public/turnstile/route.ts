export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { ensureInit } from '../../../../lib/setup';
import { getTurnstilePublicConfig } from '../../../../lib/turnstile';

function requestHost(request: Request) {
  return request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
}

export async function GET(request: Request) {
  try {
    await ensureInit();
    const cfg = getTurnstilePublicConfig(requestHost(request));
    return NextResponse.json({
      ok: true,
      enabled: cfg.enabled,
      siteKey: cfg.siteKey,
      localBypass: cfg.localBypass,
    });
  } catch (err) {
    console.error('GET /api/public/turnstile', err);
    return NextResponse.json({ ok: true, enabled: false, siteKey: '', localBypass: false });
  }
}
