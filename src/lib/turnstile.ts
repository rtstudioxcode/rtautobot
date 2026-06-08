import { config } from '../config';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function normalizeHost(hostnameOrHost?: unknown) {
  const first = String(hostnameOrHost || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  if (!first) return '';
  if (first.startsWith('[')) {
    const end = first.indexOf(']');
    return end >= 0 ? first.slice(1, end) : first.replace(/[\[\]]/g, '');
  }
  return first.split(':')[0];
}

export function isLocalTurnstileBypass(hostnameOrHost?: unknown) {
  // RTAUTOBOT behavior:
  // - local/localhost = no Turnstile widget and no server-side Turnstile block
  // - production domain = Turnstile enabled when configured in secure_config
  // Set RTAUTOBOT_ENABLE_TURNSTILE_ON_LOCAL=1 only if local Turnstile testing is needed.
  if (process.env.RTAUTOBOT_ENABLE_TURNSTILE_ON_LOCAL === '1') return false;

  const host = normalizeHost(hostnameOrHost);
  if (!host) return process.env.NODE_ENV !== 'production';

  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  );
}

export function getTurnstilePublicConfig(hostnameOrHost?: unknown) {
  const siteKey = String(config?.turnstile?.siteKey || '').trim();
  const secretKey = String(config?.turnstile?.secretKey || '').trim();
  const localBypass = isLocalTurnstileBypass(hostnameOrHost);

  return {
    enabled: Boolean(siteKey) && !localBypass,
    siteKey: localBypass ? '' : siteKey,
    serverVerifyEnabled: Boolean(siteKey && secretKey) && !localBypass,
    localBypass,
  };
}

export async function verifyTurnstileToken(token: unknown, remoteIp?: string, hostnameOrHost?: unknown) {
  if (isLocalTurnstileBypass(hostnameOrHost)) {
    return { ok: true, skipped: true, localBypass: true };
  }

  const siteKey = String(config?.turnstile?.siteKey || '').trim();
  const secretKey = String(config?.turnstile?.secretKey || '').trim();

  // If Turnstile is not fully configured, keep the old login/register behavior.
  if (!siteKey || !secretKey) {
    if (siteKey && !secretKey) {
      console.warn('[turnstile] siteKey is configured but secretKey is missing; server verification skipped.');
    }
    if (!siteKey && secretKey) {
      console.warn('[turnstile] secretKey is configured but siteKey is missing; server verification skipped.');
    }
    return { ok: true, skipped: true, incompleteConfig: true };
  }

  const response = String(token || '').trim();
  if (!response) {
    return { ok: false, message: 'กรุณายืนยัน Cloudflare Turnstile ก่อนดำเนินการ' };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secretKey);
    form.set('response', response);
    if (remoteIp) form.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    const data: any = await res.json().catch(() => ({}));
    if (data?.success) return { ok: true, data };

    console.warn('[turnstile] verification failed', data?.['error-codes'] || data);
    return { ok: false, message: 'ยืนยันความปลอดภัยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', data };
  } catch (err) {
    console.error('[turnstile] verification error', err);
    return { ok: false, message: 'ไม่สามารถตรวจสอบ Cloudflare Turnstile ได้ กรุณาลองใหม่' };
  }
}
