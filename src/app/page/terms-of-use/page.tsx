'use client';
import { useEffect, useState } from 'react';
import SvgIcon from '@/components/SvgIcon';

const CSS = `
  :root {
    --tos-bg: #06070a;
    --tos-card: #15161b;
    --tos-card-2: #1b1c22;
    --tos-text: #eef6ff;
    --tos-muted: #08b84f;
    --tos-border: rgba(255,255,255,.095);
    --tos-accent: #08b84f;
    --tos-accent-2: #a78bfa;
    --tos-green: #22c55e;
    --tos-blue: #38bdf8;
    --tos-shadow: 0 38px 110px rgba(0,0,0,.46);
    --tos-radius: 30px;
    --tos-grad: linear-gradient(135deg, #08b84f 0%, #05b84f 52%, #008c38 100%);
  }
  .tos-page { min-height: 100vh; position: relative; overflow: hidden; padding: 32px clamp(14px,2.5vw,44px) 0; }
  .tos-page::before { content: ""; position: fixed; pointer-events: none; z-index: 0; border-radius: 999px; filter: blur(20px); opacity: .72; width: 420px; height: 420px; left: -160px; top: 120px; background: radial-gradient(circle, color-mix(in srgb,var(--tos-accent) 18%,transparent), transparent 66%); }
  .tos-page::after { content: ""; position: fixed; pointer-events: none; z-index: 0; border-radius: 999px; filter: blur(20px); opacity: .72; width: 520px; height: 520px; right: -210px; bottom: -180px; background: radial-gradient(circle, color-mix(in srgb,var(--tos-blue) 13%,transparent), transparent 68%); }
  .tos-wrap { position: relative; z-index: 1; width: min(1480px,100%); margin: 0 auto; }
  .tos-hero { position: relative; overflow: hidden; border: 1px solid var(--tos-border); border-radius: 36px; padding: clamp(28px,5vw,72px); box-shadow: var(--tos-shadow); background: radial-gradient(900px 420px at 82% 18%,color-mix(in srgb,var(--tos-accent-2) 12%,transparent),transparent 62%), radial-gradient(700px 330px at 5% 18%,color-mix(in srgb,var(--tos-accent) 18%,transparent),transparent 58%), linear-gradient(135deg,color-mix(in srgb,var(--tos-card) 94%,transparent),color-mix(in srgb,var(--tos-card-2) 84%,transparent)); animation: tosRise .7s ease both; }
  .tos-hero::before { content: ""; position: absolute; inset: -2px; background: linear-gradient(115deg,transparent 0 24%,rgba(255,255,255,.12) 36%,transparent 48%); transform: translateX(-50%); animation: tosSheen 6.5s ease-in-out infinite; pointer-events: none; }
  .tos-hero-grid { display: grid; grid-template-columns: minmax(0,1.25fr) minmax(330px,.75fr); gap: clamp(22px,4vw,60px); align-items: center; position: relative; z-index: 1; }
  .tos-kicker { display: inline-flex; align-items: center; gap: 10px; border: 1px solid color-mix(in srgb,var(--tos-accent) 50%,var(--tos-border)); background: color-mix(in srgb,var(--tos-accent) 12%,transparent); color: var(--tos-accent); border-radius: 999px; padding: 10px 16px; font-weight: 900; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; box-shadow: 0 12px 32px color-mix(in srgb,var(--tos-accent) 12%,transparent); }
  .tos-hero h1 { margin: 22px 0 16px; font-size: clamp(42px,6.5vw,92px); line-height: .96; letter-spacing: -.065em; font-weight: 900; color: var(--tos-text); }
  .tos-hero p { margin: 0; max-width: 780px; color: var(--tos-muted); font-size: clamp(16px,1.35vw,22px); line-height: 1.85; font-weight: 700; }
  .tos-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 30px; }
  .tos-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 50px; padding: 0 20px; border-radius: 17px; font-weight: 900; border: 1px solid var(--tos-border); transition: transform .18s ease, box-shadow .18s ease; background: color-mix(in srgb,var(--tos-card) 82%,transparent); color: var(--tos-text); font-family: inherit; font-size: inherit; cursor: pointer; text-decoration: none; }
  .tos-btn.primary { background: var(--tos-grad); color: #03150f; border-color: color-mix(in srgb,var(--tos-accent) 70%,transparent); box-shadow: 0 16px 35px color-mix(in srgb,var(--tos-accent) 24%,transparent); }
  .tos-btn:hover { transform: translateY(-2px); box-shadow: 0 18px 36px rgba(0,0,0,.18); }
  .tos-hero-card { border: 1px solid var(--tos-border); border-radius: 28px; padding: 20px; background: linear-gradient(180deg,color-mix(in srgb,var(--tos-card) 84%,transparent),color-mix(in srgb,var(--tos-bg) 50%,transparent)); box-shadow: inset 0 1px 0 rgba(255,255,255,.08),0 22px 50px rgba(0,0,0,.18); min-height: 320px; display: grid; align-content: center; gap: 14px; }
  .tos-metric { display: flex; align-items: center; justify-content: space-between; gap: 14px; border: 1px solid var(--tos-border); border-radius: 20px; padding: 16px; background: color-mix(in srgb,var(--tos-bg) 45%,transparent); animation: tosFloat 4.8s ease-in-out infinite; }
  .tos-metric:nth-child(2) { animation-delay: .15s; }
  .tos-metric:nth-child(3) { animation-delay: .3s; }
  .tos-metric .icon { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: color-mix(in srgb,var(--tos-accent) 17%,transparent); color: var(--tos-accent); font-size: 22px; flex: 0 0 auto; }
  .tos-metric strong { display: block; font-size: 18px; font-weight: 900; color: var(--tos-text); }
  .tos-metric span { display: block; color: var(--tos-muted); font-size: 13px; font-weight: 800; margin-top: 2px; }
  .tos-metric em { font-style: normal; color: var(--tos-green); font-weight: 900; white-space: nowrap; }
  .tos-breadcrumb { display: flex; align-items: center; gap: 9px; margin: 18px 4px 0; color: var(--tos-muted); font-size: 14px; font-weight: 800; animation: tosRise .7s .1s ease both; }
  .tos-breadcrumb a { color: var(--tos-accent); text-decoration: none; }
  .tos-layout { display: grid; grid-template-columns: 310px minmax(0,1fr); gap: 22px; margin-top: 24px; align-items: start; }
  .tos-side { position: sticky; top: 18px; border: 1px solid var(--tos-border); border-radius: 26px; background: color-mix(in srgb,var(--tos-card) 88%,transparent); box-shadow: var(--tos-shadow); padding: 18px; animation: tosRise .75s .15s ease both; backdrop-filter: blur(18px); }
  .tos-side h3 { margin: 0 0 13px; font-size: 16px; font-weight: 900; color: var(--tos-text); }
  .tos-side small { display: block; color: var(--tos-muted); font-weight: 800; margin-bottom: 14px; line-height: 1.6; }
  .tos-nav { display: grid; gap: 8px; max-height: calc(100vh - 150px); overflow: auto; padding-right: 4px; }
  .tos-nav a { display: flex; align-items: center; gap: 10px; min-height: 43px; padding: 10px 12px; border-radius: 15px; color: var(--tos-muted); font-weight: 900; border: 1px solid transparent; transition: .18s ease; background: transparent; text-decoration: none; font-size: 14px; }
  .tos-nav a:hover, .tos-nav a.active { color: var(--tos-text); background: color-mix(in srgb,var(--tos-accent) 12%,transparent); border-color: color-mix(in srgb,var(--tos-accent) 30%,transparent); transform: translateX(2px); }
  .tos-nav .dot { color: var(--tos-accent); font-size: 10px; flex: 0 0 auto; }
  .tos-content { border: 1px solid var(--tos-border); border-radius: 32px; background: linear-gradient(180deg,color-mix(in srgb,var(--tos-card) 96%,transparent),color-mix(in srgb,var(--tos-card-2) 84%,transparent)); box-shadow: var(--tos-shadow); overflow: hidden; animation: tosRise .75s .22s ease both; }
  .tos-content-head { padding: 26px clamp(18px,3vw,36px); border-bottom: 1px solid var(--tos-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; background: linear-gradient(135deg,color-mix(in srgb,var(--tos-accent) 10%,transparent),transparent 55%); }
  .tos-content-head h2 { margin: 0; font-size: clamp(22px,2.4vw,34px); font-weight: 900; letter-spacing: -.03em; color: var(--tos-text); }
  .tos-updated { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid var(--tos-border); padding: 9px 13px; color: var(--tos-muted); font-weight: 900; white-space: nowrap; background: color-mix(in srgb,var(--tos-bg) 34%,transparent); font-size: 13px; }
  .tos-article { padding: clamp(18px,3vw,36px); display: grid; gap: 16px; }
  .tos-section { position: relative; border: 1px solid var(--tos-border); border-radius: 24px; padding: clamp(18px,2.4vw,28px); background: color-mix(in srgb,var(--tos-bg) 25%,transparent); overflow: hidden; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; scroll-margin-top: 20px; }
  .tos-section::before { content: ""; position: absolute; left: 0; top: 22px; width: 4px; height: 44px; border-radius: 0 999px 999px 0; background: var(--tos-grad); box-shadow: 0 0 28px color-mix(in srgb,var(--tos-accent) 50%,transparent); }
  .tos-section:hover { transform: translateY(-2px); border-color: color-mix(in srgb,var(--tos-accent) 32%,var(--tos-border)); box-shadow: 0 18px 40px rgba(0,0,0,.12); }
  .tos-section h3 { margin: 0 0 13px; padding-left: 10px; font-size: clamp(20px,1.7vw,27px); font-weight: 900; letter-spacing: -.02em; color: var(--tos-text); }
  .tos-section p, .tos-section li { color: var(--tos-muted); line-height: 1.9; font-size: 16px; font-weight: 650; }
  .tos-section p { margin: 0; }
  .tos-section ul, .tos-section ol { margin: 0; padding-left: 22px; display: grid; gap: 7px; }
  .tos-section strong { color: var(--tos-text); font-weight: 900; }
  .tos-section a { color: var(--tos-accent); font-weight: 900; }
  .tos-alert { border: 1px solid color-mix(in srgb,var(--tos-accent) 32%,var(--tos-border)); background: linear-gradient(135deg,color-mix(in srgb,var(--tos-accent) 12%,transparent),color-mix(in srgb,var(--tos-blue) 6%,transparent)); border-radius: 22px; padding: 18px; display: flex; gap: 14px; align-items: flex-start; color: var(--tos-muted); font-weight: 750; line-height: 1.8; }
  .tos-alert .ai { color: var(--tos-accent); font-size: 22px; margin-top: 4px; flex: 0 0 auto; }
  .tos-footer { margin-top: 28px; padding: 42px clamp(18px,4vw,58px); border-top: 1px solid var(--tos-border); background: linear-gradient(180deg,color-mix(in srgb,var(--tos-card) 80%,transparent),color-mix(in srgb,var(--tos-bg) 94%,transparent)); }
  .tos-footer-grid { width: min(1480px,100%); margin: auto; display: grid; grid-template-columns: 1.3fr .7fr .7fr .9fr; gap: 24px; }
  .tos-footer img { max-height: 120px; width: auto; }
  .tos-footer p, .tos-footer li, .tos-footer a { color: var(--tos-muted); font-weight: 750; line-height: 1.8; }
  .tos-footer h4 { margin: 0 0 12px; font-size: 16px; color: var(--tos-text); }
  .tos-footer ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 7px; }
  .tos-footer a { text-decoration: none; transition: color .18s; }
  .tos-footer a:hover { color: var(--tos-accent); }
  @keyframes tosRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tosFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes tosSheen { 0%,45% { transform: translateX(-60%); } 70%,100% { transform: translateX(120%); } }
  @media (max-width: 1080px) {
    .tos-hero-grid { grid-template-columns: 1fr; }
    .tos-layout { grid-template-columns: 1fr; }
    .tos-side { position: relative; top: 0; }
    .tos-nav { grid-template-columns: repeat(2,minmax(0,1fr)); max-height: none; }
    .tos-footer-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 680px) {
    .tos-page { padding: 14px 10px 0; }
    .tos-hero { border-radius: 24px; padding: 24px 18px; }
    .tos-hero h1 { font-size: 42px; letter-spacing: -.05em; }
    .tos-actions { display: grid; }
    .tos-hero-card { min-height: auto; }
    .tos-nav { grid-template-columns: 1fr; }
    .tos-section { border-radius: 18px; }
    .tos-footer-grid { grid-template-columns: 1fr; }
    .tos-content-head { align-items: flex-start; flex-direction: column; }
  }
`;

const NAV_ITEMS = [
  { id: 'sec-1', label: 'บทนำ' },
  { id: 'sec-2', label: 'คำจำกัดความ' },
  { id: 'sec-3', label: 'การใช้บริการ' },
  { id: 'sec-4', label: 'บัญชีผู้ใช้' },
  { id: 'sec-5', label: 'เครดิตและชำระเงิน' },
  { id: 'sec-6', label: 'การคืนเงิน' },
  { id: 'sec-7', label: 'ข้อห้าม' },
  { id: 'sec-8', label: 'ความรับผิดชอบผู้ใช้' },
  { id: 'sec-9', label: 'ข้อจำกัดผู้ให้บริการ' },
  { id: 'sec-10', label: 'ทรัพย์สินทางปัญญา' },
  { id: 'sec-11', label: 'ความเป็นส่วนตัว' },
  { id: 'sec-12', label: 'การแก้ไขข้อตกลง' },
  { id: 'sec-13', label: 'กฎหมายที่ใช้บังคับ' },
];

export default function TermsPage() {
  const [active, setActive] = useState('sec-1');

  useEffect(() => {
    const sections = NAV_ITEMS.map(n => document.getElementById(n.id)).filter(Boolean);
    const onScroll = () => {
      let current = sections[0]?.id;
      for (const sec of sections) {
        if (sec.getBoundingClientRect().top <= 160) current = sec.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="tos-page">
        <div className="tos-wrap">
          {/* Hero */}
          <section className="tos-hero" aria-label="Terms hero">
            <div className="tos-hero-grid">
              <div>
                <span className="tos-kicker"><SvgIcon name="shield" size={18} /> RTAUTOBOT TRUST CENTER</span>
                <h1>เงื่อนไขและข้อตกลงการใช้งาน</h1>
                <p>อ่านข้อตกลงสำคัญก่อนเริ่มใช้ Bonustime เพื่อให้การสั่งซื้อ เติมเครดิต คืนเครดิต และการใช้งานระบบทั้งหมดชัดเจน โปร่งใส และปลอดภัยระดับมืออาชีพ</p>
                <div className="tos-actions">
                  <a className="tos-btn primary" href="/bonustime"><SvgIcon name="cart" size={18} /> เริ่มใช้ Bonustime</a>
                  <a className="tos-btn" href="/faq"><SvgIcon name="info" size={18} /> อ่าน FAQ</a>
                </div>
              </div>
              <aside className="tos-hero-card" aria-label="Trust summary">
                <div className="tos-metric">
                  <div className="icon"><SvgIcon name="file" size={18} /></div>
                  <div><strong>13 หมวดหลัก</strong><span>สรุปครบทุกเงื่อนไขสำคัญ</span></div>
                  <em>Clear</em>
                </div>
                <div className="tos-metric">
                  <div className="icon"><SvgIcon name="card" size={18} /></div>
                  <div><strong>เครดิต / คืนเงิน</strong><span>ระบุเงื่อนไขการชำระและคืนเครดิต</span></div>
                  <em>Safe</em>
                </div>
                <div className="tos-metric">
                  <div className="icon"><SvgIcon name="scale" size={18} /></div>
                  <div><strong>ใช้งานถูกต้อง</strong><span>คุมความเสี่ยงและสิทธิของผู้ใช้</span></div>
                  <em>Pro</em>
                </div>
              </aside>
            </div>
          </section>

          {/* Breadcrumb */}
          <nav className="tos-breadcrumb" aria-label="breadcrumb">
            <a href="/"><SvgIcon name="home" size={18} /> หน้าแรก</a>
            <span>/</span>
            <span>เงื่อนไขและข้อตกลง</span>
          </nav>

          {/* Layout */}
          <div className="tos-layout">
            {/* Sidebar */}
            <aside className="tos-side" aria-label="สารบัญเงื่อนไข">
              <h3>สารบัญข้อตกลง</h3>
              <small>กดเพื่อเลื่อนไปยังหัวข้อที่ต้องการได้ทันที</small>
              <nav className="tos-nav" id="tosNav">
                {NAV_ITEMS.map(item => (
                  <a key={item.id} href={`#${item.id}`} className={active === item.id ? 'active' : ''}>
                    <span className="dot">●</span> {item.label}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <article className="tos-content">
              <header className="tos-content-head">
                <div>
                  <h2>Terms of Use</h2>
                  <p style={{ margin: '8px 0 0', color: 'var(--tos-muted)', fontWeight: 800, lineHeight: 1.7 }}>RTAUTOBOT — ข้อตกลงสำหรับผู้ใช้ Bonustime</p>
                </div>
                <span className="tos-updated"><SvgIcon name="calendar" size={18} /> อัปเดตล่าสุด: ตุลาคม 2568</span>
              </header>

              <div className="tos-article">
                <div className="tos-alert">
                  <span className="ai"><SvgIcon name="info" size={18} /></span>
                  <div>การเข้าใช้งานเว็บไซต์ บัญชีผู้ใช้ หรือบริการใด ๆ ถือว่าผู้ใช้ยอมรับข้อกำหนดนี้แล้ว กรุณาอ่านให้ครบก่อนเติมเครดิตหรือส่งคำสั่งซื้อ เพื่อไม่ให้เกิดดราม่าแบบซีรีส์ 12 ตอน</div>
                </div>

                <section className="tos-section" id="sec-1">
                  <h3>ข้อ 1. บทนำ</h3>
                  <p>ข้อตกลงและเงื่อนไขฉบับนี้ ("ข้อตกลง") เป็นสัญญาทางกฎหมายระหว่าง <strong>RTAUTOBOT</strong> ("ผู้ให้บริการ") และผู้ใช้บริการทุกท่าน ("ผู้ใช้" หรือ "ท่าน") การเข้าใช้งานเว็บไซต์ <a href="https://rtautobot.com" target="_blank" rel="noopener">RTAUTOBOT</a> บัญชีผู้ใช้ หรือบริการใด ๆ ถือว่าผู้ใช้ได้อ่าน ทำความเข้าใจ และยินยอมผูกพันตามข้อกำหนดนี้โดยสมบูรณ์ หากท่านไม่ยอมรับเงื่อนไขทั้งหมดหรือบางส่วน กรุณาหยุดใช้งานเว็บไซต์และบริการทันที</p>
                </section>

                <section className="tos-section" id="sec-2">
                  <h3>ข้อ 2. คำจำกัดความ</h3>
                  <ul>
                    <li><strong>"ผู้ให้บริการ"</strong> หมายถึง RTAUTOBOT รวมถึงเว็บไซต์ แพลตฟอร์ม ระบบ เซิร์ฟเวอร์ และเครื่องหมายการค้าที่เกี่ยวข้อง</li>
                    <li><strong>"ผู้ใช้"</strong> หมายถึง บุคคลธรรมดาหรือนิติบุคคลที่สมัคร เปิดบัญชี หรือเข้าถึงบริการของ RTAUTOBOT</li>
                    <li><strong>"บัญชีผู้ใช้"</strong> หมายถึง บัญชีที่ผู้ใช้ลงทะเบียนเพื่อเข้าถึงและจัดการบริการ</li>
                    <li><strong>"เครดิต"</strong> หมายถึง มูลค่าเสมือนที่ผู้ใช้เติมเข้าสู่ระบบเพื่อใช้ชำระค่าบริการ ไม่สามารถโอน แลกเปลี่ยน หรือขอคืนเงินสดได้</li>
                    <li><strong>"บริการ"</strong> หมายถึง บริการโปรโมทและโฆษณาบนสื่อสังคมออนไลน์ และบริการอื่นใดที่ RTAUTOBOT เสนอ</li>
                  </ul>
                </section>

                <section className="tos-section" id="sec-3">
                  <h3>ข้อ 3. การใช้บริการ</h3>
                  <ol>
                    <li>ผู้ใช้ต้องใช้บริการโดยสุจริต ถูกต้องตามกฎหมาย และไม่ละเมิดสิทธิของบุคคลอื่น</li>
                    <li>การกดปุ่ม "ยืนยันคำสั่งซื้อ" ถือเป็นการยอมรับข้อกำหนดและเงื่อนไขโดยอัตโนมัติ ไม่ว่าผู้ใช้จะได้อ่านหรือไม่ก็ตาม</li>
                    <li>ผู้ให้บริการมีสิทธิ์ปรับปรุง เปลี่ยนแปลง หรือยกเลิกบริการ ราคา หรือโปรโมชั่น โดยไม่ต้องแจ้งให้ทราบล่วงหน้า</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-4">
                  <h3>ข้อ 4. การลงทะเบียนและบัญชีผู้ใช้</h3>
                  <ol>
                    <li>ผู้ใช้ต้องมีอายุไม่ต่ำกว่า 18 ปี หรืออย่างน้อย 13 ปีโดยได้รับความยินยอมจากผู้ปกครอง</li>
                    <li>ผู้ใช้ต้องให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นปัจจุบัน รวมถึงอัปเดตข้อมูลเมื่อมีการเปลี่ยนแปลง</li>
                    <li>ผู้ใช้ต้องเก็บรักษาชื่อบัญชีและรหัสผ่านเป็นความลับ และรับผิดชอบต่อการใช้งานที่เกิดขึ้นจากบัญชีของตนเอง</li>
                    <li>บัญชีผู้ใช้ไม่สามารถโอน ให้ยืม หรือขายต่อได้ หากฝ่าฝืน RTAUTOBOT มีสิทธิ์ระงับหรือลบบัญชีโดยไม่ต้องแจ้งล่วงหน้า</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-5">
                  <h3>ข้อ 5. เครดิตและการชำระเงิน</h3>
                  <ol>
                    <li>ผู้ใช้ใหม่ต้องเติมเครดิตขั้นต่ำตามที่กำหนดเพื่อเริ่มใช้ Bonustime</li>
                    <li>เครดิตที่เติมแล้วไม่สามารถโอน แลกเปลี่ยน หรือขอคืนเป็นเงินสดได้ ยกเว้นกรณีบริการไม่สามารถดำเนินการได้</li>
                    <li>เมื่อคำสั่งซื้อเข้าสู่สถานะ "เสร็จสิ้น" จะไม่สามารถขอคืนเงินได้ทุกกรณี</li>
                    <li>หากพบการฉ้อโกง เช่น การใช้หลักฐานการโอนปลอม ผู้ให้บริการมีสิทธิ์ระงับบัญชีทันที</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-6">
                  <h3>ข้อ 6. นโยบายการคืนเงิน</h3>
                  <ol>
                    <li>เครดิตที่ได้รับอนุมัติแล้วจะไม่คืนเงินเข้าบัญชีผู้ใช้อีก</li>
                    <li>การคืนเครดิตจะทำได้เฉพาะกรณีที่คำสั่งซื้อไม่สามารถดำเนินการได้หรือถูกยกเลิกโดยระบบ</li>
                    <li>คำสั่งซื้อที่ผู้ใช้กรอกข้อมูลผิดพลาด หรือบัญชีโซเชียลที่ตั้งค่าเป็นส่วนตัวจะไม่เข้าข่ายคืนเงิน</li>
                    <li>หากผู้ใช้ยื่นข้อพิพาทการชำระเงินโดยมิชอบ RTAUTOBOT มีสิทธิ์ยกเลิกคำสั่งซื้อในอนาคตและระงับการใช้งาน</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-7">
                  <h3>ข้อ 7. ข้อห้ามการใช้งาน</h3>
                  <p style={{ marginBottom: '12px' }}>ผู้ใช้ตกลงว่าจะไม่ใช้บริการเพื่อกระทำการใด ๆ ที่ผิดกฎหมาย หรือขัดต่อความสงบเรียบร้อย รวมถึงแต่ไม่จำกัดเพียง:</p>
                  <ul>
                    <li>การดูหมิ่นหรือทำลายชื่อเสียงบุคคลหรือสถาบัน</li>
                    <li>การส่งสแปมหรือข้อมูลเท็จ</li>
                    <li>การละเมิดลิขสิทธิ์ เครื่องหมายการค้า หรือสิทธิในทรัพย์สินทางปัญญา</li>
                    <li>การเผยแพร่เนื้อหาลามก อนาจาร ความรุนแรง หรือปลุกปั่นยุยง</li>
                    <li>การฉ้อโกง ทุจริต หรือการใช้เอกสารปลอม</li>
                  </ul>
                </section>

                <section className="tos-section" id="sec-8">
                  <h3>ข้อ 8. ความรับผิดชอบของผู้ใช้</h3>
                  <ol>
                    <li>ผู้ใช้ต้องรับผิดชอบต่อข้อมูล เนื้อหา หรือสื่อใด ๆ ที่นำเข้าสู่ระบบ และผลทางกฎหมายที่อาจเกิดขึ้น</li>
                    <li>หากการกระทำของผู้ใช้ก่อให้เกิดความเสียหายแก่ผู้ให้บริการ หรือทำให้มีบุคคลภายนอกฟ้องร้อง ผู้ใช้ต้องชดใช้ค่าเสียหายทั้งหมดทันที</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-9">
                  <h3>ข้อ 9. ความรับผิดชอบและข้อจำกัดของผู้ให้บริการ</h3>
                  <ol>
                    <li>ผู้ให้บริการจะพยายามอย่างเต็มที่เพื่อให้ระบบมีเสถียรภาพ แต่ไม่รับประกันว่าจะปราศจากข้อบกพร่องหรือการหยุดชะงัก</li>
                    <li>ผู้ให้บริการไม่รับผิดชอบต่อความเสียหายทางตรง ทางอ้อม หรือผลสืบเนื่องที่เกิดจากการใช้หรือไม่สามารถใช้บริการ</li>
                    <li>กรณีเหตุสุดวิสัย ผู้ให้บริการจะไม่ถือว่าผิดสัญญา</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-10">
                  <h3>ข้อ 10. ทรัพย์สินทางปัญญา</h3>
                  <ol>
                    <li>เนื้อหา ระบบ ซอฟต์แวร์ และข้อมูลทั้งหมดบนเว็บไซต์เป็นทรัพย์สินของ RTAUTOBOT</li>
                    <li>ห้ามผู้ใช้คัดลอก ดัดแปลง เผยแพร่ แจกจ่าย หรือทำวิศวกรรมย้อนกลับ เว้นแต่ได้รับอนุญาตเป็นลายลักษณ์อักษร</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-11">
                  <h3>ข้อ 11. นโยบายความเป็นส่วนตัว</h3>
                  <ol>
                    <li>RTAUTOBOT ไม่ร้องขอรหัสผ่านของผู้ใช้</li>
                    <li>ข้อมูลทั้งหมดจะถูกเข้ารหัสและเก็บรักษาอย่างปลอดภัย</li>
                    <li>ผู้ให้บริการสงวนสิทธิ์ในการปรับปรุงหรือแก้ไขนโยบายความเป็นส่วนตัวโดยไม่ต้องแจ้งล่วงหน้า</li>
                  </ol>
                </section>

                <section className="tos-section" id="sec-12">
                  <h3>ข้อ 12. การแก้ไขข้อตกลง</h3>
                  <p>ผู้ให้บริการสงวนสิทธิ์ในการแก้ไข เพิ่มเติม หรือปรับปรุงข้อตกลง โดยมีผลทันทีเมื่อเผยแพร่บนเว็บไซต์ การใช้งานต่อไปของผู้ใช้ถือเป็นการยอมรับข้อตกลงที่แก้ไขแล้ว</p>
                </section>

                <section className="tos-section" id="sec-13">
                  <h3>ข้อ 13. กฎหมายที่ใช้บังคับ</h3>
                  <p>ข้อตกลงนี้อยู่ภายใต้กฎหมายแห่งราชอาณาจักรไทย และข้อพิพาทใด ๆ ที่เกิดขึ้นให้อยู่ในเขตอำนาจศาลไทย</p>
                </section>
              </div>
            </article>
          </div>
        </div>

        {/* Footer */}
        <footer className="tos-footer">
          <div className="tos-footer-grid">
            <div>
              <img src="/assets/logo/logo-rtautobot.png" alt="RTAUTOBOT logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <p>RTAUTOBOT ผู้ให้บริการ Bonustime บริการการตลาดออนไลน์และโซเชียลระดับสากล มาตรฐานมืออาชีพ ดูแลลูกค้าทั่วไทย</p>
            </div>
            <div>
              <h4>ผลิตภัณฑ์</h4>
              <ul>
                <li><a href="/">หน้าแรก</a></li>
                <li><a href="/bonustime">Bonustime</a></li>
                <li><a href="/bonustime">ประวัติ Bonustime</a></li>
              </ul>
            </div>
            <div>
              <h4>FAQ</h4>
              <ul>
                <li><a href="/faq">คำถามที่พบบ่อย</a></li>
                <li><a href="/support">ติดต่อทีมงาน</a></li>
              </ul>
            </div>
            <div>
              <h4>เกี่ยวกับเรา</h4>
              <ul>
                <li><a href="mailto:rtssm.th@gmail.com"><SvgIcon name="mail" size={18} /> Email: rtssm.th@gmail.com</a></li>
                <li><a href="https://line.me/R/ti/p/@507vkplq"><SvgIcon name="message" size={18} /> Line: @rtssm-th</a></li>
                <li><a href="/support"><SvgIcon name="bug" size={18} /> แจ้งปัญหาคำสั่งซื้อ</a></li>
                <li><a href="/page/terms-of-use"><SvgIcon name="scale" size={18} /> เงื่อนไขและข้อตกลง</a></li>
              </ul>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
