import './globals.css';
import { getSession } from '../lib/session.js';
import Sidebar from '../components/Sidebar.jsx';
import SbBackdrop from '../components/SbBackdrop.jsx';
import Topbar from '../components/Topbar.jsx';

export const metadata = {
  title: { default: 'RTAUTOBOT | ระบบ Bonustime อัตโนมัติ', template: '%s | RTAUTOBOT' },
  description: 'RTAUTOBOT ศูนย์สั่งซื้อและจัดการ Bonustime สำหรับสล็อต บาคาร่า และหวย',
  keywords: 'RTAUTOBOT, Bonustime, ระบบโบนัสไทม์, บอทโบนัสไทม์, สล็อต, บาคาร่า, หวย',
  openGraph: {
    siteName: 'RTAUTOBOT',
    locale: 'th_TH',
    type: 'website',
    images: [{ url: 'https://rtautobot.com/og/og-default.png' }],
  },
  icons: {
    icon: [
      { url: '/assets/logo/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/assets/logo/favicon-96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/assets/logo/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#050505',
};

export default async function RootLayout({ children }) {
  const session = await getSession();
  const user = session?.user || null;

  return (
    <html lang="th" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try {
    var t = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.classList.toggle('light', t === 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }
})();`,
          }}
        />
        <script
          id="service-worker-cleanup"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs){
        regs.forEach(function(reg){
          try { reg.unregister(); } catch (e) {}
        });
      }).catch(function(){});
    }
    if ('caches' in window) {
      caches.keys().then(function(keys){
        keys.forEach(function(key){
          try { caches.delete(key); } catch (e) {}
        });
      }).catch(function(){});
    }
  } catch (e) {}
})();`,
          }}
        />
        <script
          id="turnstile-callback"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `window.onTurnstileLoad = window.onTurnstileLoad || function () {
  try { window.dispatchEvent(new Event('turnstile-ready')); } catch (e) {}
};`,
          }}
        />
        <script
          id="cf-turnstile-api"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad"
          async
          defer
          suppressHydrationWarning
        />
      </head>
      <body>
        {/* Sidebar (fixed, full height) */}
        <Sidebar user={user} />

        {/* Mobile backdrop — closes sidebar on tap */}
        <SbBackdrop />

        {/* Main shell: topbar + content + footer */}
        <div className="sb-wrap">
          <Topbar user={user} />

          <main>
            {children}
          </main>

          <footer className="rt-footer">
            Copyright &copy; 2025 RTAUTOBOT - All rights reserved. | Design by CC.Dev
          </footer>
        </div>
      </body>
    </html>
  );
}
