import { getSession } from '../../lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: 'Admin' };

const CSS = `
.rt-admin-layout {
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% 0%, rgba(8,184,79,.12), transparent 28%),
    radial-gradient(circle at 90% 8%, rgba(60,100,255,.10), transparent 30%),
    linear-gradient(180deg, #08090d, #07080b);
  color: #eef6ff;
}
.rt-admin-wrap {
  max-width: 2000px;
  margin: 0 auto;
  padding: 18px 18px 80px;
}
.rt-admin-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 22px;
  padding: 10px;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 22px;
  background: linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),#17181d;
  box-shadow: 0 18px 48px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.06);
  overflow-x: auto;
  scrollbar-width: none;
  flex-wrap: nowrap;
}
.rt-admin-nav::-webkit-scrollbar { display: none; }
.rt-admin-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 12px;
  border: 1px solid rgba(239,68,68,.32);
  background: rgba(239,68,68,.12);
  color: #fca5a5;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.rt-admin-nav-link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(255,255,255,.04);
  color: rgba(238,246,255,.72);
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
  transition: background .18s ease, border-color .18s ease, color .18s ease;
}
.rt-admin-nav-link:hover {
  background: rgba(8,184,79,.12);
  border-color: rgba(8,184,79,.32);
  color: #eef6ff;
}
`;

export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'admin') redirect('/dashboard');

  const NAV = [
    { href: '/admin', label: 'ภาพรวม' },
    { href: '/admin/users', label: 'ผู้ใช้' },
    { href: '/admin/topup', label: 'เติมเงิน' },
    { href: '/admin/bonustime', label: 'Bonustime' },
    { href: '/admin/report', label: 'รายงาน' },
    { href: '/admin/settings', label: 'ตั้งค่า' },
  ];

  return (
    <div className="rt-admin-layout">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rt-admin-wrap">
        {/* <nav className="rt-admin-nav" aria-label="Admin navigation">
          <span className="rt-admin-badge">Admin</span>
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rt-admin-nav-link">{label}</Link>
          ))}
        </nav> */}
        {children}
      </div>
    </div>
  );
}
