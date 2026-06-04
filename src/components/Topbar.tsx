'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const CSS = `
/* ===== DESKTOP TOPBAR ===== */
.rt-topbar {
  position: sticky;
  top: 0;
  z-index: 900;
  isolation: isolate;
  min-height: 74px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 82%, transparent);
  background:
    radial-gradient(520px 150px at 18% 0%, color-mix(in srgb, #08b84f 16%, transparent), transparent 68%),
    linear-gradient(135deg, color-mix(in srgb, #17181d 96%, #fff 4%), color-mix(in srgb, #17181d 82%, #000 18%));
  backdrop-filter: blur(22px) saturate(1.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.35);
  box-shadow: 0 18px 50px rgba(0,0,0,.22), inset 0 1px rgba(255,255,255,.05);
  overflow: hidden;
}
.rt-topbar::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,.06) 42%, transparent 62%);
  transform: translateX(-120%);
  animation: rtTopbarSheen 8s ease-in-out infinite;
}
@keyframes rtTopbarSheen {
  0%, 72% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}

.rt-topbar.desktop { display: flex; }
@media (max-width: 900px) {
  .rt-topbar.desktop { display: none !important; }
}
.rt-topbar-glow {
  position: absolute; right: 16%; top: -120px;
  width: 360px; height: 220px; border-radius: 999px;
  background: color-mix(in srgb, #08b84f 12%, transparent);
  filter: blur(38px); pointer-events: none; opacity: .8;
}

.rt-brand-wrap {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.rt-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  text-decoration: none;
  color: #eef6ff;
  min-width: 0;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 90%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, #17181d 80%, transparent), color-mix(in srgb, #17181d 40%, transparent));
  box-shadow: inset 0 1px rgba(255,255,255,.05);
  transition: transform .22s ease, border-color .22s ease;
}
.rt-brand:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #08b84f 45%, rgba(255,255,255,.10));
}
.rt-brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  font-weight: 650;
  font-size: 13px;
  letter-spacing: -.03em;
  color: #14100a;
  background: linear-gradient(135deg, #08b84f, #08b84f, #05b84f);
  box-shadow: 0 12px 28px color-mix(in srgb, #08b84f 24%, transparent), inset 0 1px rgba(255,255,255,.55);
  flex: 0 0 34px;
}
.rt-brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
  min-width: 0;
}
.rt-brand-copy strong {
  font-weight: 650;
  font-size: 14px;
  letter-spacing: .02em;
  color: #eef6ff;
  white-space: nowrap;
}
.rt-brand-copy small {
  font-weight: 520;
  font-size: 10px;
  color: #08b84f;
  white-space: nowrap;
  opacity: .9;
}
.rt-brand-line {
  font-size: 13px;
  font-weight: 560;
  color: #08b84f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: min(52vw, 760px);
}
@media (max-width: 1100px) {
  .rt-brand-line { display: none; }
  .rt-brand-copy small { display: none; }
}

.rt-nav {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rt-action-pill {
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #eef6ff;
  padding: 6px 13px 6px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 90%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, #17181d 86%, transparent), color-mix(in srgb, #17181d 55%, transparent));
  box-shadow: inset 0 1px rgba(255,255,255,.05), 0 10px 26px rgba(0,0,0,.18);
  transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease;
  cursor: pointer;
  font-family: inherit;
}
.rt-action-pill:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, #08b84f 48%, rgba(255,255,255,.10));
  box-shadow: 0 16px 34px rgba(0,0,0,.24), 0 0 0 4px color-mix(in srgb, #08b84f 8%, transparent);
}

.rt-pill-ico {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #08b84f;
  background: color-mix(in srgb, #08b84f 12%, #17181d);
  border: 1px solid color-mix(in srgb, #08b84f 30%, transparent);
  overflow: hidden;
}
.rt-pill-ico.danger {
  color: #ff6868;
  background: color-mix(in srgb, #ff4d4f 12%, #17181d);
  border-color: color-mix(in srgb, #ff4d4f 34%, transparent);
}
.rt-pill-ico svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.rt-pill-ico img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.rt-pill-text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}
.rt-pill-text small {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: #08b84f;
  opacity: .75;
}
.rt-pill-text strong {
  font-size: 14px;
  font-weight: 650;
  color: #eef6ff;
  white-space: nowrap;
}
.rt-balance-pill .rt-pill-text strong { color: #08b84f; }
.rt-logout-pill .rt-pill-text strong { color: #ff6b6b; }

/* ===== MOBILE TOPBAR ===== */
.m-topbar { display: none; }
@media (max-width: 900px) { .m-topbar { display: flex; } }

.rt-mobile-topbar {
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  min-height: 60px;
  position: sticky;
  top: 0;
  z-index: 940;
  border-bottom: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 80%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, #17181d 94%, transparent), color-mix(in srgb, #17181d 82%, #000 18%));
  backdrop-filter: blur(20px) saturate(1.25);
  -webkit-backdrop-filter: blur(20px) saturate(1.25);
  box-shadow: 0 16px 44px rgba(0,0,0,.22);
}

.rt-mobile-menu {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 17px;
  border: 1px solid color-mix(in srgb, #08b84f 35%, rgba(255,255,255,.10));
  background: linear-gradient(180deg, color-mix(in srgb, #15161b 92%, #000), color-mix(in srgb, #08090d 92%, #000));
  color: #08b84f;
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 10px 24px rgba(0,0,0,.28);
  transition: transform .22s ease;
}
.rt-mobile-menu > span {
  display: block;
  height: 2px;
  border-radius: 99px;
  background: linear-gradient(90deg, #21b95c, #05b84f);
  box-shadow: 0 0 12px rgba(124,255,178,.35);
}
.rt-mobile-menu > span:nth-child(1) { width: 21px; }
.rt-mobile-menu > span:nth-child(2) { width: 25px; }
.rt-mobile-menu > span:nth-child(3) { width: 21px; }
.rt-mobile-menu:hover { transform: translateY(-1px); }

.rt-mobile-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #eef6ff;
  text-decoration: none;
  font-weight: 650;
}

.m-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rt-mobile-balance {
  border: 1px solid color-mix(in srgb, #08b84f 28%, rgba(255,255,255,.10));
  background: color-mix(in srgb, #17181d 86%, transparent);
  color: #08b84f;
  font-weight: 700;
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 999px;
  text-decoration: none;
  transition: transform .2s ease;
}
.rt-mobile-balance:hover { transform: translateY(-1px); }

/* ===== MOBILE SUBNAV ===== */
.m-subnav {
  display: none;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 12px;
  gap: 8px;
  position: sticky;
  top: 60px;
  z-index: 930;
  background: color-mix(in srgb, #17181d 94%, transparent);
  border-bottom: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 75%, transparent);
  box-shadow: 0 12px 26px rgba(0,0,0,.12);
  backdrop-filter: blur(14px) saturate(132%);
  -webkit-backdrop-filter: blur(14px) saturate(132%);
  scrollbar-width: none;
}
.m-subnav::-webkit-scrollbar { display: none; }
@media (max-width: 900px) { .m-subnav { display: flex; } }

.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, rgba(255,255,255,.10) 88%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, #17181d 88%, transparent), color-mix(in srgb, #17181d 58%, transparent));
  color: rgba(238,246,255,.8);
  font-size: 13px;
  font-weight: 620;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: inset 0 1px rgba(255,255,255,.05);
  transition: transform .2s ease, border-color .2s ease;
  cursor: pointer;
  font-family: inherit;
}
.chip:hover,
.chip.active {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, #08b84f 48%, rgba(255,255,255,.10));
}
.chip-ico {
  width: 18px;
  height: 18px;
  object-fit: contain;
}
`;

// Dollar SVG for balance pill
const DollarSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

// Logout SVG
const LogoutSvg = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Brand mark R icon
const BrandMark = () => (
  <span className="rt-brand-mark">R</span>
);

export default function Topbar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function toggleMobileMenu() {
    document.body.classList.toggle('sb-mobile-open');
  }

  async function handleLogoutChip(e) {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const balance = typeof user?.balance === 'number'
    ? user.balance.toLocaleString('th-TH', { maximumFractionDigits: 2 })
    : '0';

  const hasAvatar = user?.avatarUrl && !user.avatarUrl.includes('icon-logo');

  function isChipActive(href) {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ===== DESKTOP TOPBAR ===== */}
      <header className="topbar desktop rt-topbar">
        <div className="rt-topbar-glow" aria-hidden="true" />
        {/* Left: Brand */}
        <div className="left rt-brand-wrap">
          <Link href="/dashboard" className="rt-brand">
            <BrandMark />
            <span className="rt-brand-copy">
              <strong>RTAUTOBOT</strong>
              <small>Bonustime Automation Center</small>
            </span>
          </Link>
          <span className="rt-brand-line">เปิดใช้งานระบบบอทอัตโนมัติ — Bonustime สล็อต บาคาร่า และหวย</span>
        </div>

        {/* Right: Nav */}
        <nav className="nav rt-nav">
          {user ? (
            <>
              {/* Balance */}
              <Link href="/topup" className="rt-action-pill rt-balance-pill">
                <span className="rt-pill-ico">
                  <DollarSvg />
                </span>
                <div className="rt-pill-text">
                  <small>เครดิต</small>
                  <strong>฿{balance}</strong>
                </div>
              </Link>

              {/* Logout */}
              <button
                className="rt-action-pill rt-logout-pill"
                onClick={logout}
                type="button"
              >
                <span className="rt-pill-ico danger">
                  <LogoutSvg />
                </span>
                <div className="rt-pill-text">
                  <small>Session</small>
                  <strong>ออกระบบ</strong>
                </div>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rt-action-pill">
                <span className="rt-pill-ico">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
                <div className="rt-pill-text">
                  <small>เข้าสู่</small>
                  <strong>เข้าสู่ระบบ</strong>
                </div>
              </Link>
              <Link href="/register" className="rt-action-pill">
                <span className="rt-pill-ico">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </span>
                <div className="rt-pill-text">
                  <small>ใหม่</small>
                  <strong>สมัครสมาชิก</strong>
                </div>
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* ===== MOBILE TOPBAR ===== */}
      <div className="m-topbar rt-mobile-topbar">
        <button
          className="rt-mobile-menu js-sb-toggle"
          onClick={toggleMobileMenu}
          type="button"
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <Link href="/dashboard" className="rt-mobile-brand">
          <BrandMark />
          <span>RTAUTOBOT</span>
        </Link>

        <div className="m-right">
          {user ? (
            <Link href="/topup" className="m-pill rt-mobile-balance">
              ฿{balance}
            </Link>
          ) : (
            <Link href="/login" className="m-pill rt-mobile-balance">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>

      {/* ===== MOBILE SUBNAV ===== */}
      <nav className="m-subnav">
        {user ? (
          <>
            <Link
              href="/dashboard"
              className={`chip chip--with-ico${isChipActive('/dashboard') ? ' active' : ''}`}
            >
              <img className="chip-ico" src="/assets/emoji/dashboard.png" alt="" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/bonustime"
              className={`chip chip--with-ico${isChipActive('/bonustime') ? ' active' : ''}`}
            >
              <img className="chip-ico" src="/assets/emoji/ordernew.png" alt="" />
              <span>Bonustime</span>
            </Link>

            {user.role === 'admin' && (
              <Link
                href="/admin"
                className={`chip chip--with-ico${isChipActive('/admin') ? ' active' : ''}`}
              >
                <img className="chip-ico" src="/assets/emoji/admin.png" alt="" />
                <span>หลังบ้าน</span>
              </Link>
            )}

            <button
              className="chip chip--with-ico"
              onClick={handleLogoutChip}
              type="button"
            >
              <img className="chip-ico" src="/assets/emoji/logout.png" alt="" />
              <span>ออกระบบ</span>
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className={`chip chip--with-ico${isChipActive('/login') ? ' active' : ''}`}>
              <img className="chip-ico" src="/assets/emoji/login.png" alt="" />
              <span>เข้าสู่ระบบ</span>
            </Link>
            <Link href="/register" className={`chip chip--with-ico${isChipActive('/register') ? ' active' : ''}`}>
              <img className="chip-ico" src="/assets/emoji/register.png" alt="" />
              <span>สมัครสมาชิก</span>
            </Link>
          </>
        )}
      </nav>
    </>
  );
}
