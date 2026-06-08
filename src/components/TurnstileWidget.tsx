'use client';

import { useEffect, useRef, useState } from 'react';

type TurnstileWidgetProps = {
  action?: string;
  className?: string;
  resetKey?: number;
  onEnabledChange?: (enabled: boolean) => void;
  onTokenChange: (token: string) => void;
};

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function TurnstileWidget({
  action,
  className = '',
  resetKey = 0,
  onEnabledChange,
  onTokenChange,
}: TurnstileWidgetProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState('');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/public/turnstile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((cfg) => {
        if (!alive) return;
        const nextEnabled = Boolean(cfg?.enabled && cfg?.siteKey);
        setEnabled(nextEnabled);
        setSiteKey(nextEnabled ? String(cfg.siteKey) : '');
        onEnabledChange?.(nextEnabled);
        if (!nextEnabled) onTokenChange('');
      })
      .catch(() => {
        if (!alive) return;
        setEnabled(false);
        onEnabledChange?.(false);
        onTokenChange('');
      });
    return () => {
      alive = false;
    };
  }, [onEnabledChange, onTokenChange]);

  useEffect(() => {
    if (!enabled || !siteKey || !boxRef.current) return;
    let cancelled = false;

    loadTurnstileScript().then((loaded) => {
      if (cancelled) return;
      if (!loaded || !window.turnstile || !boxRef.current) {
        setLoadError('โหลดระบบยืนยันความปลอดภัยไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่');
        return;
      }

      if (widgetRef.current) {
        try { window.turnstile.remove(widgetRef.current); } catch {}
        widgetRef.current = null;
      }

      setLoadError('');
      widgetRef.current = window.turnstile.render(boxRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        action,
        callback: (token: string) => {
          onTokenChange(token || '');
          setReady(true);
        },
        'expired-callback': () => {
          onTokenChange('');
          setReady(false);
        },
        'error-callback': () => {
          onTokenChange('');
          setReady(false);
          setLoadError('ยืนยันความปลอดภัยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        },
      });
    });

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetRef.current); } catch {}
        widgetRef.current = null;
      }
    };
  }, [action, enabled, siteKey, onTokenChange]);

  useEffect(() => {
    if (!enabled || !widgetRef.current || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetRef.current);
      onTokenChange('');
      setReady(false);
      setLoadError('');
    } catch {}
  }, [enabled, onTokenChange, resetKey]);

  if (!enabled) return null;

  return (
    <div className={`rt-turnstile ${className}`.trim()}>
      <div ref={boxRef} className="rt-turnstile-box" />
      {!ready && !loadError ? <div className="rt-turnstile-hint">กำลังเตรียมระบบยืนยันความปลอดภัย...</div> : null}
      {loadError ? <div className="rt-turnstile-error">{loadError}</div> : null}
    </div>
  );
}
