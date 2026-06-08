import { getSession } from '../../lib/session';
import { redirect } from 'next/navigation';
import { ensureInit } from '../../lib/setup';
import { User } from '../../models/User';
import Link from 'next/link';
import SvgIcon from '@/components/SvgIcon';

export const metadata = { title: 'แดชบอร์ด' };
export const dynamic = 'force-dynamic';

const CSS = `
.dashx{
  --dx-page:#08090d;--dx-card:#15161b;--dx-text:#eef6ff;--dx-muted:#b7ad98;
  --dx-border:rgba(255,255,255,.12);--dx-accent:#08b84f;--dx-accent-2:#21b95c;
  --dx-green:#05b84f;--dx-soft:color-mix(in srgb,#15161b 82%,transparent);
  --dx-shadow:rgba(0,0,0,.44);--dx-success:#22c55e;--dx-danger:#fb5b63;--dx-warn:#08b84f;
  position:relative;isolation:isolate;min-height:calc(100dvh - 120px);
  padding:clamp(14px,2.2vw,28px);color:var(--dx-text);overflow:hidden;
}
.dashx *{box-sizing:border-box}
.dashx a{text-decoration:none;color:inherit}
.dashx-aurora{
  position:absolute;inset:-20%;z-index:-2;pointer-events:none;
  background:
    radial-gradient(circle at 12% 4%,color-mix(in srgb,var(--dx-accent) 22%,transparent),transparent 32%),
    radial-gradient(circle at 84% 10%,rgba(126,87,255,.18),transparent 30%),
    radial-gradient(circle at 48% 92%,rgba(28,196,161,.12),transparent 28%);
  filter:blur(14px);animation:dashxFloat 13s ease-in-out infinite alternate;
}
.card-lux{
  position:relative;border:1px solid var(--dx-border);border-radius:28px;
  background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.018)),
    color-mix(in srgb,var(--dx-card) 92%,transparent);
  box-shadow:0 24px 64px var(--dx-shadow),inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter:blur(18px);overflow:hidden;
}
.card-lux::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(135deg,rgba(255,255,255,.13),transparent 28%,color-mix(in srgb,var(--dx-accent) 13%,transparent) 72%,transparent);
  opacity:.65}
.card-lux::after{content:"";position:absolute;width:180px;height:180px;right:-80px;top:-90px;
  border-radius:999px;background:color-mix(in srgb,var(--dx-accent) 15%,transparent);filter:blur(24px);pointer-events:none}
.reveal-up{animation:dashxReveal .62s cubic-bezier(.2,.75,.22,1) both;animation-delay:var(--delay,0s)}
.dashx-hero{min-height:300px;padding:clamp(24px,4vw,48px);display:grid;
  grid-template-columns:minmax(0,1.5fr) minmax(280px,.62fr);gap:clamp(18px,3vw,34px);align-items:center}
.dashx-kicker{width:max-content;max-width:100%;display:inline-flex;align-items:center;gap:9px;
  padding:9px 15px;border-radius:999px;
  border:1px solid color-mix(in srgb,var(--dx-accent) 45%,var(--dx-border));
  color:var(--dx-accent-2);font-weight:900;font-size:12px;letter-spacing:.08em;text-transform:uppercase;
  background:color-mix(in srgb,var(--dx-accent) 10%,transparent)}
.dashx-hero h1{margin:18px 0 10px;font-size:clamp(48px,7vw,92px);line-height:.94;
  letter-spacing:-.055em;color:var(--dx-text);
  text-shadow:0 18px 44px color-mix(in srgb,var(--dx-accent) 16%,transparent)}
.dashx-hero>div>p{margin:0;max-width:760px;color:color-mix(in srgb,var(--dx-text) 72%,var(--dx-muted));
  font-size:clamp(15px,1.35vw,19px);line-height:1.85;font-weight:700}
.dashx-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.dashx-btn{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:10px;
  padding:12px 18px;border-radius:16px;border:1px solid var(--dx-border);font-weight:900;
  transition:transform .2s ease,box-shadow .2s ease,filter .2s ease,background .2s ease}
.dashx-btn:hover{transform:translateY(-2px)}
.dashx-btn-primary{color:#17130a;background:linear-gradient(135deg,#21b95c,#05b84f 55%,#05b84f);
  box-shadow:0 16px 34px color-mix(in srgb,var(--dx-accent) 28%,transparent)}
.dashx-btn-soft{background:var(--dx-soft);color:var(--dx-text)}
.dashx-profile-glass{position:relative;z-index:1;min-height:250px;border-radius:26px;
  border:1px solid var(--dx-border);
  background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.02));
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:22px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
.dashx-avatar-wrap{position:relative;width:132px;height:132px;display:grid;place-items:center;margin-bottom:14px}
.dashx-avatar-ring{position:absolute;inset:0;border-radius:999px;
  background:conic-gradient(from 90deg,var(--dx-accent),transparent 34%,rgba(126,87,255,.75),transparent 74%,var(--dx-accent));
  animation:dashxSpin 8s linear infinite;
  filter:drop-shadow(0 12px 24px color-mix(in srgb,var(--dx-accent) 18%,transparent))}
.dashx-avatar-wrap img{position:relative;width:118px;height:118px;border-radius:999px;
  object-fit:cover;border:5px solid color-mix(in srgb,var(--dx-card) 92%,transparent);background:var(--dx-card)}
.dashx-user-name{font-size:20px;font-weight:1000;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dashx-user-email{font-size:13px;color:var(--dx-muted);max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;margin-top:4px}
.dashx-mini-link{margin-top:14px;color:var(--dx-accent-2);font-weight:900;font-size:13px}
.dashx-grid{display:grid;gap:18px;margin-top:18px}
.dashx-grid-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
.dashx-grid-main{grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr)}
.dashx-stat{min-height:150px;padding:22px;display:flex;align-items:center;gap:16px}
.dashx-stat__icon{width:58px;height:58px;border-radius:20px;display:grid;place-items:center;font-size:25px;
  flex:0 0 58px;background:rgba(255,255,255,.07);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 18px 32px rgba(0,0,0,.18)}
.dashx-stat__icon.warn{background:color-mix(in srgb,var(--dx-warn) 18%,transparent)}
.dashx-stat__icon.success{background:color-mix(in srgb,var(--dx-success) 18%,transparent)}
.dashx-stat__icon.danger{background:color-mix(in srgb,var(--dx-danger) 18%,transparent)}
.dashx-label{display:block;color:var(--dx-muted);font-size:12px;font-weight:900;
  letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.dashx-value{display:block;color:var(--dx-text);font-size:clamp(22px,2.1vw,31px);
  line-height:1.12;font-weight:1000;letter-spacing:-.03em}
.dashx-stat p,.dashx-panel p{margin:8px 0 0;color:var(--dx-muted);font-size:13px;line-height:1.65;font-weight:650}
.dashx-panel{padding:24px;min-height:330px}
.dashx-headline{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;
  gap:14px;margin-bottom:18px;padding:0!important;border:0!important;border-radius:0!important;
  background:transparent!important;background-image:none!important;box-shadow:none!important;
  backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:visible!important}
.dashx-headline::before,.dashx-headline::after,.dashx-headline>div::before,.dashx-headline>div::after{content:none!important;display:none!important}
.dashx-headline>div{padding:0!important;border:0!important;border-radius:0!important;
  background:transparent!important;background-image:none!important;
  box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.dashx-panel h2{margin:0;padding:0!important;border:0!important;background:transparent!important;
  background-image:none!important;box-shadow:none!important;color:var(--dx-text);
  font-size:clamp(22px,2.4vw,34px);letter-spacing:-.04em}
.dashx-chip{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;
  padding:8px 12px;color:#17130a;font-weight:1000;
  background:linear-gradient(135deg,#21b95c,#05b84f);
  box-shadow:0 12px 24px color-mix(in srgb,var(--dx-accent) 22%,transparent)}
.dashx-progress-block{position:relative;z-index:1;padding:18px;border-radius:22px;
  border:1px solid var(--dx-border);background:rgba(255,255,255,.035)}
.dashx-progress-row{display:flex;align-items:center;justify-content:space-between;gap:12px;
  color:var(--dx-muted);font-weight:800}
.dashx-progress-row strong{color:var(--dx-accent-2);font-size:20px}
.dashx-progress-track{height:12px;border-radius:999px;background:rgba(255,255,255,.075);
  overflow:hidden;margin:14px 0 4px;border:1px solid var(--dx-border)}
.dashx-progress-fill{height:100%;border-radius:999px;
  background:linear-gradient(90deg,#21b95c,#05b84f,#22c55e);
  box-shadow:0 0 24px color-mix(in srgb,var(--dx-accent) 42%,transparent);
  animation:dashxBar 1.1s cubic-bezier(.2,.75,.22,1) both}
.dashx-info-list{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
.dashx-info-list div,.dashx-quick-actions a{border:1px solid var(--dx-border);border-radius:18px;
  background:rgba(255,255,255,.035);padding:14px;
  transition:transform .2s ease,border-color .2s ease,background .2s ease}
.dashx-info-list span{display:block;color:var(--dx-muted);font-size:12px;font-weight:800;margin-bottom:5px}
.dashx-info-list strong{color:var(--dx-text);font-size:15px}
.dashx-quick-actions{position:relative;z-index:1;display:grid;gap:12px}
.dashx-quick-actions a{display:grid;grid-template-columns:42px 1fr;column-gap:12px;align-items:center}
.dashx-quick-actions a:hover{transform:translateY(-2px);
  border-color:color-mix(in srgb,var(--dx-accent) 42%,var(--dx-border));
  background:color-mix(in srgb,var(--dx-accent) 8%,transparent)}
.dashx-quick-actions span{grid-row:1/3;width:42px;height:42px;border-radius:15px;display:grid;place-items:center;
  background:color-mix(in srgb,var(--dx-accent) 14%,transparent)}
.dashx-quick-actions strong{font-size:16px;color:var(--dx-text)}
.dashx-quick-actions small{color:var(--dx-muted);font-weight:700;margin-top:2px}
@keyframes dashxReveal{from{opacity:0;transform:translateY(22px) scale(.985);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
@keyframes dashxFloat{from{transform:translate3d(-1%,0,0) scale(1)}to{transform:translate3d(1.4%,1%,0) scale(1.04)}}
@keyframes dashxSpin{to{transform:rotate(360deg)}}
@keyframes dashxBar{from{width:0;filter:saturate(.8)}to{filter:saturate(1.08)}}
@media(max-width:1100px){
  .dashx-hero{grid-template-columns:1fr}
  .dashx-grid-stats,.dashx-grid-main{grid-template-columns:1fr}
  .dashx-profile-glass{min-height:auto}
  .dashx-info-list{grid-template-columns:1fr}}
@media(max-width:640px){
  .dashx{padding:12px}
  .dashx-hero{padding:22px;border-radius:24px}
  .dashx-hero h1{font-size:46px}
  .dashx-actions{display:grid}.dashx-btn{width:100%}
  .dashx-stat{align-items:flex-start;border-radius:22px}
  .dashx-avatar-wrap{width:108px;height:108px}
  .dashx-avatar-wrap img{width:96px;height:96px}
  .dashx-panel,.dashx-stat{padding:18px}
  .dashx-headline{align-items:flex-start;flex-direction:column}
  .dashx-progress-row{align-items:flex-start;flex-direction:column}}
@media(prefers-reduced-motion:reduce){.dashx *{animation:none!important;transition:none!important}}
`;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  await ensureInit();

  const user = await User.findById(session.user._id)
    .select('username name email balance currency level levelName totalSpent btSpent points toNextLevel nextLevelName totalOrders affiliateKey avatarUrl')
    .lean();

  if (!user) redirect('/login');

  const NAME = user.name || user.username || '-';
  const EMAIL = user.email || '-';
  const rawAvatar = user.avatarUrl || '/assets/logo/icon-logo.png';
  const AVATAR = rawAvatar.startsWith('/static/logo/') ? rawAvatar.replace('/static/logo/', '/assets/logo/')
    : rawAvatar.startsWith('/static/assets/') ? rawAvatar.replace('/static/assets/', '/assets/')
    : rawAvatar;
  const LEVEL = user.levelName || (user.level ? `เลเวล ${user.level}` : '-');
  const TOTAL_SPENT = Number(user.totalSpent || user.btSpent || 0);
  const TOTAL_ORDERS = Number(user.totalOrders || 0);
  const POINTS = Math.floor(TOTAL_SPENT / 100);
  const progressPct = Math.max(8, Math.min(100, (TOTAL_SPENT % 10000) / 100));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="dashx page" aria-label="Dashboard">
        <div className="dashx-aurora" aria-hidden="true" />

        <section className="dashx-hero card-lux reveal-up">
          <div className="dashx-hero__copy">
            <div className="dashx-kicker"><span><SvgIcon name="spark" size={18} /></span> Account Center</div>
            <h1>Dashboard</h1>
            <p>ศูนย์ควบคุมบัญชีของคุณ ดูระดับ ยอดใช้งาน และภาพรวมคำสั่งซื้อ</p>
            <div className="dashx-actions">
              <Link className="dashx-btn dashx-btn-primary" href="/bonustime"><span><SvgIcon name="rocket" size={18} /></span> สั่งซื้อบริการ</Link>
              <Link className="dashx-btn dashx-btn-soft" href="/account"><span><SvgIcon name="user" size={18} /></span> จัดการบัญชี</Link>
            </div>
          </div>

          <div className="dashx-profile-glass" aria-label="ข้อมูลผู้ใช้">
            <div className="dashx-avatar-wrap">
              <span className="dashx-avatar-ring" aria-hidden="true" />
              <img src={AVATAR} alt="รูปโปรไฟล์" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </div>
            <div className="dashx-user-name">{NAME}</div>
            <div className="dashx-user-email">{EMAIL}</div>
            <Link className="dashx-mini-link" href="/account">ข้อมูลส่วนตัว →</Link>
          </div>
        </section>

        <section className="dashx-grid dashx-grid-stats" aria-label="สรุปบัญชี">
          <article className="dashx-stat card-lux reveal-up" style={{ '--delay': '.04s' }}>
            <div className="dashx-stat__icon warn"><SvgIcon name="trophy" size={18} /></div>
            <div className="dashx-stat__body">
              <span className="dashx-label">ระดับผู้ใช้</span>
              <strong className="dashx-value">{LEVEL}</strong>
              <p>ดูเงื่อนไขเลื่อนระดับได้ที่หน้าข้อมูลบัญชี</p>
            </div>
          </article>

          <article className="dashx-stat card-lux reveal-up" style={{ '--delay': '.10s' }}>
            <div className="dashx-stat__icon success"><SvgIcon name="gem" size={18} /></div>
            <div className="dashx-stat__body">
              <span className="dashx-label">ใช้งานไปแล้ว</span>
              <strong className="dashx-value">฿{TOTAL_SPENT.toFixed(2)}</strong>
              <p>ยอดค่าใช้จ่ายสะสมจากทุกบริการ</p>
            </div>
          </article>

          <article className="dashx-stat card-lux reveal-up" style={{ '--delay': '.16s' }}>
            <div className="dashx-stat__icon danger"><SvgIcon name="cart" size={18} /></div>
            <div className="dashx-stat__body">
              <span className="dashx-label">สั่งไปแล้ว</span>
              <strong className="dashx-value">{TOTAL_ORDERS.toLocaleString('th-TH')} ออเดอร์</strong>
              <p>จำนวนคำสั่งซื้อทั้งหมดในบัญชีนี้</p>
            </div>
          </article>
        </section>

        <section className="dashx-grid dashx-grid-main">
          <article className="dashx-panel card-lux reveal-up" style={{ '--delay': '.22s' }}>
            <div className="dashx-headline">
              <div>
                <span className="dashx-label">Account Insight</span>
                <h2>ภาพรวมการเติบโต</h2>
              </div>
              <span className="dashx-chip">Live</span>
            </div>

            <div className="dashx-progress-block">
              <div className="dashx-progress-row">
                <span>คะแนนโดยประมาณ</span>
                <strong>{POINTS.toLocaleString('th-TH')} คะแนน</strong>
              </div>
              <div className="dashx-progress-track" aria-hidden="true">
                <div className="dashx-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p>ระบบคำนวณจากยอดใช้บริการสะสม ยิ่งใช้งานมาก ยิ่งปลดล็อกสิทธิ์และระดับที่สูงขึ้น</p>
            </div>

            <div className="dashx-info-list">
              <div><span>สถานะบัญชี</span><strong>พร้อมใช้งาน</strong></div>
              <div><span>ประสบการณ์ใช้งาน</span><strong>Professional</strong></div>
              <div><span>จัดการข้อมูล</span><strong>Realtime</strong></div>
            </div>
          </article>

          <aside className="dashx-panel card-lux reveal-up" style={{ '--delay': '.28s' }}>
            <div className="dashx-headline">
              <div>
                <span className="dashx-label">Quick Actions</span>
                <h2>เมนูลัด</h2>
              </div>
            </div>

            <div className="dashx-quick-actions">
              <Link href="/bonustime"><span><SvgIcon name="zap" size={18} /></span><strong>เริ่มสั่งซื้อ</strong><small>เลือกบริการและส่งงาน</small></Link>
              <Link href="/bonustime"><span><SvgIcon name="file" size={18} /></span><strong>ประวัติคำสั่งซื้อ</strong><small>ติดตามสถานะทั้งหมด</small></Link>
              <Link href="/topup"><span><SvgIcon name="money" size={18} /></span><strong>เติมเครดิต</strong><small>เพิ่มยอดคงเหลือ</small></Link>
              <Link href="/account"><span><SvgIcon name="shield" size={18} /></span><strong>ข้อมูลบัญชี</strong><small>โปรไฟล์และระดับบัญชี</small></Link>
            </div>
          </aside>
        </section>
      </section>
    </>
  );
}
