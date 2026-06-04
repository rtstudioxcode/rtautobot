'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const CSS = `
.wallet-page {
  --wl-page: #07080b; --wl-card: #17181d; --wl-card2: #111218;
  --wl-text: #eef6ff; --wl-muted: #08b84f; --wl-border: rgba(255,255,255,.12);
  --wl-accent: #08b84f; --wl-shadow: rgba(0,0,0,.42);
  min-height: 100vh; position: relative; isolation: isolate;
  padding: clamp(20px,4vw,52px) clamp(14px,3vw,36px);
  color: var(--wl-text);
}
.wallet-page::before {
  content: ""; position: absolute; inset: -18px -18px auto;
  height: 320px; pointer-events: none; z-index: -1;
  background:
    radial-gradient(circle at 14% 8%, color-mix(in srgb,var(--wl-accent) 22%,transparent), transparent 34%),
    radial-gradient(circle at 82% 6%, rgba(80,120,255,.18), transparent 32%),
    linear-gradient(180deg, color-mix(in srgb,var(--wl-card) 42%,transparent), transparent 88%);
}
.wallet-wrap { max-width: 520px; margin: 0 auto; }
.wallet-hero {
  position: relative; overflow: hidden; border-radius: 34px; margin-bottom: 20px;
  border: 1px solid rgba(124,255,178,.22);
  background:
    radial-gradient(circle at 16% 12%,rgba(124,255,178,.16),transparent 30%),
    radial-gradient(circle at 86% 22%,rgba(80,120,255,.14),transparent 32%),
    linear-gradient(145deg, rgba(28,28,32,.96), rgba(14,14,18,.98));
  box-shadow: 0 30px 80px var(--wl-shadow), inset 0 1px 0 rgba(255,255,255,.06);
  padding: 34px 28px 28px;
  text-align: center; animation: wlRise .6s cubic-bezier(.2,.9,.2,1) both;
}
.wallet-hero::before {
  content: ""; position: absolute; inset: 0 0 auto; height: 3px;
  background: linear-gradient(90deg, transparent, #08b84f, transparent); opacity: .9;
}
.wallet-kicker {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px;
  border: 1px solid rgba(124,255,178,.34); background: rgba(124,255,178,.08);
  color: #08b84f; font-size: 11px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase;
  margin-bottom: 14px;
}
.wallet-balance-label { color: rgba(238,246,255,.6); font-size: 14px; font-weight: 700; margin: 0 0 6px; }
.wallet-balance-amount { font-size: clamp(44px,10vw,74px); font-weight: 1000; letter-spacing: -.05em; color: var(--wl-accent); line-height: 1; margin: 0 0 6px; }
.wallet-balance-sub { color: rgba(238,246,255,.4); font-size: 13px; font-weight: 700; }
.wallet-balance-skeleton { width: 180px; height: 74px; border-radius: 18px; background: rgba(255,255,255,.06); margin: 0 auto 6px; animation: wlPulse 1.4s ease-in-out infinite; }
.wallet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
.wallet-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px;
  border-radius: 18px; font-size: 15px; font-weight: 800; font-family: inherit; cursor: pointer;
  text-decoration: none; transition: transform .2s ease, filter .2s ease;
}
.wallet-btn:hover { transform: translateY(-2px); filter: saturate(1.05); }
.wallet-btn.primary {
  border: 0; color: #17130a;
  background: linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);
  box-shadow: 0 18px 40px rgba(8,184,79,.22), inset 0 1px 0 rgba(255,255,255,.55);
}
.wallet-btn.ghost {
  border: 1px solid var(--wl-border); color: var(--wl-text);
  background: rgba(255,255,255,.055);
}
@keyframes wlRise { from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes wlPulse { 0%,100%{opacity:.5}50%{opacity:.9} }
`;

export default function WalletPage() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/wallet').then(r => r.json()).then(d => {
      setBalance(d.balance ?? 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wallet-page">
        <div className="wallet-wrap">
          <div className="wallet-hero">
            <div className="wallet-kicker"><span>✦</span> RTAUTOBOT WALLET</div>
            <p className="wallet-balance-label">ยอดเงินคงเหลือ</p>
            {loading ? (
              <div className="wallet-balance-skeleton" />
            ) : (
              <p className="wallet-balance-amount">
                ฿{Number(balance).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
            )}
            <p className="wallet-balance-sub">บาท</p>

            <div className="wallet-actions">
              <Link href="/topup" className="wallet-btn primary">เติมเงิน →</Link>
              <Link href="/account" className="wallet-btn ghost">บัญชีของฉัน</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
