'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const CSS = `
:root {
  --sbx-page: var(--page, #08090d);
  --sbx-card: var(--card, #15161b);
  --sbx-text: var(--text, #e8fff1);
  --sbx-muted: var(--muted, #08b84f);
  --sbx-border: var(--border, rgba(255,255,255,.10));
  --sbx-accent: var(--accent, #08b84f);
  --rt-menu-green: #08b84f;
  --rt-menu-green-2: #05b84f;
  --rt-menu-ink: var(--text, #eef6ff);
  --rt-menu-surface: color-mix(in srgb, var(--card, #171719) 92%, #050507);
  --rt-menu-line: color-mix(in srgb, var(--border, #2b2b31) 78%, transparent);
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 1005;
  width: 64px;
  overflow: hidden;
  background:
    radial-gradient(420px 280px at 8% 0%, color-mix(in srgb, #08b84f 16%, transparent), transparent 58%),
    linear-gradient(180deg, color-mix(in srgb, #15161b 94%, #111318), color-mix(in srgb, #08090d 96%, #050507));
  border-right: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 88%, transparent);
  box-shadow: 0 22px 60px rgba(0,0,0,.42);
  color: #e8fff1;
  transition: width .28s cubic-bezier(.2,.8,.2,1);
  display: flex;
  flex-direction: column;
}
.sidebar:hover,
.sidebar.open,
.sidebar.pinned {
  width: 240px;
}

@media (max-width: 900px) {
  .sidebar {
    width: min(240px, 84vw);
    transform: translateX(-110%);
    transition: transform .28s cubic-bezier(.2,.8,.2,1);
  }
  .sidebar.open,
  body.sb-mobile-open .sidebar {
    transform: translateX(0);
  }
}

.sb-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  min-height: 74px;
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, #08b84f 12%, transparent), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, #15161b 96%, #111), color-mix(in srgb, #15161b 88%, #000));
  border-bottom: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 78%, transparent);
}

.sb-brand {
  flex: 1 1 auto;
  min-width: 0;
  height: auto;
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: transparent;
  border: 0;
  box-shadow: none;
  text-decoration: none;
}
.sb-brand .brand-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  object-fit: contain;
  display: none;
}
.sb-brand .brand-wordmark {
  display: block;
  object-fit: contain;
  width: 290px;
  max-width: 290px;
  height: 86px;
  filter: drop-shadow(0 8px 18px rgba(0,0,0,.34));
  transition: opacity .22s ease, width .28s cubic-bezier(.2,.8,.2,1), height .28s cubic-bezier(.2,.8,.2,1), transform .22s ease;
  overflow: hidden;
}
.sidebar:not(.open):not(.pinned):not(:hover) .sb-brand .brand-wordmark {
  opacity: 0;
  width: 0;
  height: 0;
  transform: translateX(-6px);
  pointer-events: none;
}
.sidebar:not(.open):not(.pinned):not(:hover) .sb-brand .brand-icon {
  display: block;
}

@media (max-width: 900px) {
  .sidebar:not(.open) .sb-brand .brand-wordmark { opacity: 0; width: 0; height: 0; transform: translateX(-6px); pointer-events: none; }
  .sidebar:not(.open) .sb-brand .brand-icon { display: block; }
  .sidebar.open .sb-brand { height: auto; min-height: 86px; justify-content: center; }
  .sidebar.open .sb-brand .brand-wordmark { opacity: 1; width: 290px; height: 86px; transform: none; }
  .sidebar.open .sb-brand .brand-icon { display: none; }
}

.sb-pin {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, #08b84f 35%, rgba(255,255,255,.10));
  background: linear-gradient(180deg, color-mix(in srgb, #15161b 92%, #000), color-mix(in srgb, #08090d 92%, #000));
  color: #08b84f;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 10px 24px rgba(0,0,0,.28);
  transition: transform .22s ease, border-color .22s ease;
}
.sb-pin:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #08b84f 68%, transparent);
}
.sidebar:not(.open):not(.pinned):not(:hover) .sb-pin {
  display: none;
}
@media (max-width: 900px) {
  .sidebar:not(.open) .sb-pin { display: none; }
  .sidebar.open .sb-pin { display: grid; }
}

.sb-list {
  padding: 18px 14px 22px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(8,184,79,.2) transparent;
}
.sb-list::-webkit-scrollbar { width: 4px; }
.sb-list::-webkit-scrollbar-track { background: transparent; }
.sb-list::-webkit-scrollbar-thumb { background: rgba(8,184,79,.2); border-radius: 99px; }

.sb-group {
  display: block;
  width: 100%;
  margin: 2px 0;
  padding: 0 10px;
  color: #08b84f;
  font-size: 12px;
  line-height: 1.2;
  letter-spacing: .02em;
  font-weight: 400;
  opacity: .95;
  white-space: nowrap;
  transition: opacity .22s ease;
}
.sidebar:not(.open):not(.pinned):not(:hover) .sb-group {
  opacity: 0;
  height: 0;
  overflow: hidden;
  margin: 0;
}
@media (max-width: 900px) {
  .sidebar:not(.open) .sb-group { opacity: 0; height: 0; overflow: hidden; margin: 0; }
  .sidebar.open .sb-group { opacity: .95; height: auto; overflow: visible; margin: 2px 0; }
}

.sb-item {
  min-height: 48px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  padding: 10px 13px;
  border-radius: 16px;
  color: #eef6ff;
  border: 1px solid transparent;
  background: transparent;
  text-decoration: none;
  overflow: hidden;
  position: relative;
  transition: transform .2s ease, border-color .2s ease, background .2s ease, box-shadow .2s ease;
}
.sb-item::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, #08b84f 14%, transparent), transparent 62%);
  opacity: 0;
  pointer-events: none;
  transition: opacity .22s ease;
}
.sb-item:hover,
.sb-item.active {
  transform: translateX(2px);
  background:
    radial-gradient(circle at 18% 50%, color-mix(in srgb, #08b84f 20%, transparent), transparent 48%),
    linear-gradient(135deg, color-mix(in srgb, #08b84f 13%, #15161b), color-mix(in srgb, #15161b 96%, transparent));
  border-color: color-mix(in srgb, #08b84f 42%, rgba(255,255,255,.10));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 10px 26px rgba(0,0,0,.18);
}
.sb-item:hover::before,
.sb-item.active::before {
  opacity: 1;
}

.sidebar:not(.open):not(.pinned):not(:hover) .sb-item {
  justify-content: center;
  padding: 10px 0;
}
.sidebar:not(.open):not(.pinned):not(:hover) .sb-item .txt {
  display: none;
}
@media (max-width: 900px) {
  .sidebar:not(.open) .sb-item { justify-content: center; padding: 10px 0; }
  .sidebar:not(.open) .sb-item .txt { display: none; }
  .sidebar.open .sb-item { justify-content: flex-start; padding: 10px 13px; }
  .sidebar.open .sb-item .txt { display: block; }
}

.sb-item .ico {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  object-fit: contain;
}
.sb-item .ico.ei {
  width: 24px;
  height: 24px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #15110a;
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,.78), transparent 30%),
    linear-gradient(135deg, #21b95c 0%, #08b84f 48%, #05b84f 100%);
  box-shadow: 0 0 0 1px rgba(184,255,212,.32), 0 8px 18px rgba(6,199,85,.20), inset 0 1px 0 rgba(255,255,255,.38);
}
.sb-item .ico.ei.green {
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,.78), transparent 30%),
    linear-gradient(135deg, #21b95c 0%, #08b84f 48%, #05b84f 100%);
  color: #15110a;
}
.sb-item .ico.ei.red {
  color: #fff;
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,.22), transparent 30%),
    linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 0 0 1px rgba(239,68,68,.32), 0 8px 18px rgba(239,68,68,.20), inset 0 1px 0 rgba(255,255,255,.18);
}
.sb-item .ico.ei.blue {
  color: #fff;
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,.22), transparent 30%),
    linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  box-shadow: 0 0 0 1px rgba(59,130,246,.32), 0 8px 18px rgba(59,130,246,.20), inset 0 1px 0 rgba(255,255,255,.18);
}
.sb-item .ico.ei.slate {
  color: #21b95c;
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,.18), transparent 30%),
    linear-gradient(135deg, #30333d 0%, #171920 55%, #090b10 100%);
  box-shadow: 0 0 0 1px rgba(24,201,100,.16), 0 8px 18px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.08);
}
.sb-item .ico.ei.support {
  color: #15110a;
  background:
    radial-gradient(circle at 28% 18%, rgba(255,255,255,.80), transparent 30%),
    linear-gradient(135deg, #21b95c 0%, #08b84f 45%, #05b84f 100%);
}
.sb-item .ico.ei svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sb-item .txt {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  margin-left: 10px;
}
`;

// SVG icons
const WalletSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 7H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    <path d="M16 3H5a2 2 0 0 0-2 2v2" />
    <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const BoxSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const HeadphonesSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

const FaqSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const DocSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const AdminSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LoginSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

const RegisterSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const LineSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 11.5C21 16.75 16.75 21 11.5 21c-5.25 0-9.5-4.25-9.5-9.5C2 6.25 6.25 2 11.5 2 16.75 2 21 6.25 21 11.5z" />
    <path d="M17 11c0-2.76-2.24-5-5-5s-5 2.24-5 5c0 2.48 1.8 4.54 4.17 4.93.16.03.38.09.43.21.05.11.03.27.02.38l-.07.42c-.02.12-.1.47.41.26.51-.21 2.73-1.61 3.73-2.75A4.94 4.94 0 0 0 17 11z" />
    <path d="M14.5 9.5h-3M14.5 11h-3M14.5 12.5h-3" />
  </svg>
);

const TelegramSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.198 2.433a2.242 2.242 0 0 0-1.022.215l-17.5 7.5a2.25 2.25 0 0 0 .126 4.145l3.7 1.233 1.976 6.009a.75.75 0 0 0 1.248.292l2.638-2.638 4.385 3.512a2.25 2.25 0 0 0 3.544-1.285l3.25-16.5a2.25 2.25 0 0 0-2.345-2.483z" fill="currentColor" stroke="none" />
  </svg>
);

const PinSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
  </svg>
);

function normalizeAvatar(url) {
  if (!url) return '/assets/logo/icon-logo.png';
  if (url.startsWith('/static/logo/')) return url.replace('/static/logo/', '/assets/logo/');
  if (url.startsWith('/static/assets/')) return url.replace('/static/assets/', '/assets/');
  return url;
}

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const sidebarRef = useRef(null);

  // Handle body class for sb-expanded on desktop hover/pin
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;

    function onMouseEnter() {
      if (window.innerWidth > 900 && !el.classList.contains('pinned')) {
        document.body.classList.add('sb-expanded');
      }
    }
    function onMouseLeave() {
      if (window.innerWidth > 900 && !el.classList.contains('pinned')) {
        document.body.classList.remove('sb-expanded');
      }
    }

    el.addEventListener('mouseenter', onMouseEnter);
    el.addEventListener('mouseleave', onMouseLeave);
    return () => {
      el.removeEventListener('mouseenter', onMouseEnter);
      el.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  function togglePin() {
    const el = sidebarRef.current;
    if (!el) return;
    const willPin = !el.classList.contains('pinned');
    el.classList.toggle('pinned', willPin);
    if (willPin) {
      document.body.classList.add('sb-expanded');
    } else {
      document.body.classList.remove('sb-expanded');
    }
  }

  // Listen for mobile open state
  useEffect(() => {
    function onBodyClassChange() {
      const el = sidebarRef.current;
      if (!el) return;
      if (document.body.classList.contains('sb-mobile-open')) {
        el.classList.add('open');
      } else {
        el.classList.remove('open');
      }
    }

    const observer = new MutationObserver(onBodyClassChange);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  function isActive(href) {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <aside id="sb" className="sidebar" ref={sidebarRef}>
        {/* Head */}
        <div className="sb-head">
          <Link href="/" className="sb-brand">
            <img className="brand-icon" src="/assets/logo/icon-logo.png" alt="RT" />
            <img className="brand-wordmark" src="/assets/logo/logo-rtautobot.png" alt="RTAUTOBOT" />
          </Link>
          <button className="sb-pin" aria-label="Pin sidebar" type="button" onClick={togglePin}>
            <img src="/assets/emoji/menu.png" alt="" width="18" height="18" />
          </button>
        </div>

        {/* Nav */}
        <nav className="sb-list" onClick={() => { if (window.innerWidth <= 900) document.body.classList.remove('sb-mobile-open'); }}>
          {user ? (
            <>
              {/* User group */}
              <div className="sb-group">รายการผู้ใช้งาน</div>

              <Link
                href="/dashboard"
                className={`sb-item${isActive('/dashboard') ? ' active' : ''}`}
              >
                <img
                  className="ico"
                  src={normalizeAvatar(user.avatarUrl)}
                  alt=""
                  style={{ borderRadius: '6px' }}
                  width="24" height="24"
                />
                <span className="txt">ข้อมูลผู้ใช้งาน</span>
              </Link>

              <Link
                href="/topup"
                className={`sb-item${isActive('/topup') ? ' active' : ''}`}
              >
                <span className="ico ei green">
                  <WalletSvg />
                </span>
                <span className="txt">เติมเครดิต</span>
              </Link>

              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  className={`sb-item${isActive('/admin') ? ' active' : ''}`}
                >
                  <span className="ico ei blue">
                    <AdminSvg />
                  </span>
                  <span className="txt">จัดการระบบ</span>
                </Link>
              )}

              {/* Services group */}
              <div className="sb-group">บริการ</div>

              <Link
                href="/bonustime"
                className={`sb-item${isActive('/bonustime') ? ' active' : ''}`}
              >
                <span className="ico ei">
                  <BoxSvg />
                </span>
                <span className="txt">Bonustime</span>
              </Link>

              {/* Contact group */}
              <div className="sb-group">ติดต่อ</div>

              <Link
                href="/support"
                className={`sb-item${isActive('/support') ? ' active' : ''}`}
              >
                <span className="ico ei support">
                  <HeadphonesSvg />
                </span>
                <span className="txt">ติดต่อทีมงาน</span>
              </Link>

              {/* Info group */}
              <div className="sb-group">ข้อมูล/ระบบ</div>

              <Link
                href="/faq"
                className={`sb-item${isActive('/faq') ? ' active' : ''}`}
              >
                <span className="ico ei slate">
                  <FaqSvg />
                </span>
                <span className="txt">คำถามที่พบบ่อย FAQ</span>
              </Link>

              <Link
                href="/page/terms-of-use"
                className={`sb-item${isActive('/page/terms-of-use') ? ' active' : ''}`}
              >
                <span className="ico ei slate">
                  <DocSvg />
                </span>
                <span className="txt">เงื่อนไขและข้อตกลง</span>
              </Link>
            </>
          ) : (
            <>
              {/* Guest group */}
              <div className="sb-group">เข้าสู่ระบบ</div>

              <Link
                href="/login"
                className={`sb-item${isActive('/login') ? ' active' : ''}`}
              >
                <span className="ico ei green">
                  <LoginSvg />
                </span>
                <span className="txt">เข้าสู่ระบบ</span>
              </Link>

              <Link
                href="/register"
                className={`sb-item${isActive('/register') ? ' active' : ''}`}
              >
                <span className="ico ei blue">
                  <RegisterSvg />
                </span>
                <span className="txt">สมัครสมาชิก</span>
              </Link>

              <div className="sb-group">ช่องทางติดต่อ</div>

              <a
                href="https://line.me/ti/p/~@rtautobot"
                target="_blank"
                rel="noopener noreferrer"
                className="sb-item"
              >
                <span className="ico ei green">
                  <LineSvg />
                </span>
                <span className="txt">Line Official</span>
              </a>

              <a
                href="https://t.me/rtautobot"
                target="_blank"
                rel="noopener noreferrer"
                className="sb-item"
              >
                <span className="ico ei blue">
                  <TelegramSvg />
                </span>
                <span className="txt">Telegram</span>
              </a>

              <div className="sb-group">ข้อมูล/ระบบ</div>

              <Link
                href="/faq"
                className={`sb-item${isActive('/faq') ? ' active' : ''}`}
              >
                <span className="ico ei slate">
                  <FaqSvg />
                </span>
                <span className="txt">คำถามที่พบบ่อย FAQ</span>
              </Link>

              <Link
                href="/page/terms-of-use"
                className={`sb-item${isActive('/page/terms-of-use') ? ' active' : ''}`}
              >
                <span className="ico ei slate">
                  <DocSvg />
                </span>
                <span className="txt">เงื่อนไขและข้อตกลง</span>
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
