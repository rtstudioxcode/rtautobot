'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ConfirmVariant = 'default' | 'danger' | 'warning' | 'success';

type ConfirmOptions = {
  title?: string;
  message?: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant | string;
  tone?: ConfirmVariant | string;
};

type ConfirmRequest = Required<Pick<ConfirmOptions, 'title' | 'message' | 'confirmText' | 'cancelText'>> & {
  detail?: string;
  variant: ConfirmVariant;
  resolve: (value: boolean) => void;
};

const CSS = `
.rt-confirm-root{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:22px;pointer-events:none;opacity:0;transition:opacity .16s ease;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Thai","Prompt",Arial,sans-serif;}
.rt-confirm-root.is-open{opacity:1;pointer-events:auto;}
.rt-confirm-backdrop{position:absolute;inset:0;background:rgba(3,7,12,.70);backdrop-filter:blur(18px) saturate(118%);}
.rt-confirm-backdrop::before{content:"";position:absolute;inset:0;background:radial-gradient(520px 260px at 50% 18%,rgba(28,214,120,.10),transparent 64%),linear-gradient(180deg,rgba(255,255,255,.035),transparent 44%);}
.rt-confirm-dialog{position:relative;width:min(470px,calc(100vw - 34px));overflow:hidden;border-radius:26px;border:1px solid rgba(255,255,255,.13);background:linear-gradient(180deg,rgba(26,28,34,.98),rgba(12,14,18,.98));box-shadow:0 28px 88px rgba(0,0,0,.58),0 0 0 1px rgba(6,199,85,.10);color:#eef6ff;transform:translateY(8px) scale(.985);transition:transform .18s cubic-bezier(.2,.8,.2,1);}
.rt-confirm-root.is-open .rt-confirm-dialog{transform:translateY(0) scale(1);}
.rt-confirm-topline{height:3px;background:linear-gradient(90deg,#05b84f,#2eea86);opacity:.95;}
.rt-confirm-shell{padding:24px 24px 20px;}
.rt-confirm-header{display:grid;grid-template-columns:48px 1fr;gap:15px;align-items:start;}
.rt-confirm-icon{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;color:#03130a;background:linear-gradient(135deg,#24dc78,#05b84f);box-shadow:0 14px 34px rgba(5,184,79,.22);}
.rt-confirm-icon svg{width:22px;height:22px;}
.rt-confirm-copy{min-width:0;}
.rt-confirm-title{margin:1px 0 0;font-size:20px;line-height:1.25;font-weight:900;letter-spacing:-.02em;color:#f3fbff;}
.rt-confirm-message{margin:8px 0 0;color:#b7c8bd;font-size:14px;line-height:1.65;font-weight:650;white-space:pre-line;}
.rt-confirm-detail{margin:14px 0 0;padding:12px 13px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#8ef0b7;font-size:13px;line-height:1.55;font-weight:750;white-space:pre-line;}
.rt-confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px;}
.rt-confirm-btn{appearance:none;border:0;border-radius:16px;padding:12px 17px;min-width:104px;font:inherit;font-size:14px;font-weight:900;cursor:pointer;transition:transform .14s ease,background .14s ease,border-color .14s ease,box-shadow .14s ease;color:#eafff2;}
.rt-confirm-btn:active{transform:translateY(1px);}
.rt-confirm-cancel{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.12);color:#d6e4dc;}
.rt-confirm-cancel:hover{background:rgba(255,255,255,.085);border-color:rgba(255,255,255,.18);}
.rt-confirm-ok{color:#06140c;background:linear-gradient(135deg,#2eed84,#05b84f);box-shadow:0 14px 32px rgba(5,184,79,.22);}
.rt-confirm-ok:hover{box-shadow:0 17px 40px rgba(5,184,79,.30);}
.rt-confirm-root[data-variant="danger"] .rt-confirm-topline{background:linear-gradient(90deg,#ff5b6f,#ff9b73);}
.rt-confirm-root[data-variant="danger"] .rt-confirm-icon{background:linear-gradient(135deg,#ff8090,#ff435b);box-shadow:0 14px 34px rgba(255,67,91,.20);color:#1b0608;}
.rt-confirm-root[data-variant="danger"] .rt-confirm-ok{background:linear-gradient(135deg,#ff8090,#ff435b);box-shadow:0 14px 32px rgba(255,67,91,.20);color:#1b0608;}
.rt-confirm-root[data-variant="warning"] .rt-confirm-topline{background:linear-gradient(90deg,#f4c95d,#ff9f43);}
.rt-confirm-root[data-variant="warning"] .rt-confirm-icon{background:linear-gradient(135deg,#f7d36b,#ffad33);color:#1a1102;box-shadow:0 14px 34px rgba(255,173,51,.18);}
.rt-confirm-root[data-variant="warning"] .rt-confirm-ok{background:linear-gradient(135deg,#f7d36b,#ffad33);color:#1a1102;box-shadow:0 14px 32px rgba(255,173,51,.18);}
@media (max-width:640px){.rt-confirm-root{align-items:end;padding:12px;}.rt-confirm-dialog{width:100%;border-radius:24px 24px 20px 20px;}.rt-confirm-shell{padding:22px 18px 18px;}.rt-confirm-header{grid-template-columns:42px 1fr;gap:13px;}.rt-confirm-icon{width:42px;height:42px;border-radius:14px;}.rt-confirm-title{font-size:18px;}.rt-confirm-actions{display:grid;grid-template-columns:1fr 1fr;}.rt-confirm-btn{min-width:0;width:100%;}}
`;

function normalizeVariant(value?: unknown): ConfirmVariant {
  const v = String(value || '').toLowerCase();
  if (['danger', 'error', 'delete', 'remove', 'reject'].includes(v)) return 'danger';
  if (['warn', 'warning', 'restart', 'reset'].includes(v)) return 'warning';
  if (['success', 'ok'].includes(v)) return 'success';
  return 'default';
}

function toOptions(input: ConfirmOptions | string = {}): ConfirmOptions {
  if (typeof input === 'string') return { message: input };
  return input || {};
}

function iconSvg(variant: ConfirmVariant) {
  if (variant === 'danger') {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M12 16.7h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M10.2 4.5h3.6l7 12.1a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3l7-12.1Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/></svg>;
  }
  if (variant === 'warning') {
    return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/><path d="M12 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M4.5 19.2h15L12 3.8 4.5 19.2Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12.8 11.3 15 16 9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="1.9"/></svg>;
}

export default function GlobalConfirm() {
  const [current, setCurrent] = useState<ConfirmRequest | null>(null);
  const queueRef = useRef<ConfirmRequest[]>([]);
  const currentRef = useRef<ConfirmRequest | null>(null);

  const showNext = useCallback(() => {
    if (currentRef.current) return;
    const next = queueRef.current.shift() || null;
    currentRef.current = next;
    setCurrent(next);
  }, []);

  const close = useCallback((value: boolean) => {
    const req = currentRef.current;
    if (!req) return;
    req.resolve(value);
    currentRef.current = null;
    setCurrent(null);
    window.setTimeout(showNext, 80);
  }, [showNext]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (!document.getElementById('rt-confirm-style')) {
      const style = document.createElement('style');
      style.id = 'rt-confirm-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    const openConfirm = (input: ConfirmOptions | string = {}) => new Promise<boolean>((resolve) => {
      const opts = toOptions(input);
      const variant = normalizeVariant(opts.variant || opts.tone);
      const request: ConfirmRequest = {
        title: String(opts.title || 'ยืนยันการทำรายการ'),
        message: String(opts.message || 'ต้องการดำเนินการต่อใช่ไหม?'),
        detail: opts.detail ? String(opts.detail) : undefined,
        confirmText: String(opts.confirmText || 'ยืนยัน'),
        cancelText: String(opts.cancelText || 'ยกเลิก'),
        variant,
        resolve,
      };
      queueRef.current.push(request);
      showNext();
    });

    (window as any).rtConfirm = openConfirm;
    (window as any).UIConfirm = openConfirm;
    (window as any).uiConfirm = openConfirm;
    (window as any).__rtConfirmReady = true;

    const onConfirm = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      openConfirm(detail).then((value) => {
        if (typeof detail.resolve === 'function') detail.resolve(value);
      });
    };
    window.addEventListener('rt:confirm', onConfirm as EventListener);

    return () => {
      window.removeEventListener('rt:confirm', onConfirm as EventListener);
    };
  }, [showNext]);

  useEffect(() => {
    if (!current) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, close]);

  return (
    <div className={`rt-confirm-root${current ? ' is-open' : ''}`} data-variant={current?.variant || 'default'} aria-hidden={!current}>
      <div className="rt-confirm-backdrop" onClick={() => close(false)} />
      {current ? (
        <section className="rt-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="rt-confirm-title" aria-describedby="rt-confirm-message">
          <div className="rt-confirm-topline" />
          <div className="rt-confirm-shell">
            <div className="rt-confirm-header">
              <div className="rt-confirm-icon">{iconSvg(current.variant)}</div>
              <div className="rt-confirm-copy">
                <h2 id="rt-confirm-title" className="rt-confirm-title">{current.title}</h2>
                <p id="rt-confirm-message" className="rt-confirm-message">{current.message}</p>
                {current.detail ? <div className="rt-confirm-detail">{current.detail}</div> : null}
              </div>
            </div>
            <div className="rt-confirm-actions">
              <button className="rt-confirm-btn rt-confirm-cancel" type="button" onClick={() => close(false)}>{current.cancelText}</button>
              <button className="rt-confirm-btn rt-confirm-ok" type="button" autoFocus onClick={() => close(true)}>{current.confirmText}</button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
