'use client';
import { useState, useMemo } from 'react';

const CSS = `
  :root {
    --faq-page: #08090d;
    --faq-card: #17181e;
    --faq-card2: color-mix(in srgb, #17181e 78%, #242630);
    --faq-text: #eef6ff;
    --faq-muted: #08b84f;
    --faq-border: rgba(255,255,255,.12);
    --faq-accent: #08b84f;
    --faq-accent2: #05b84f;
    --faq-success: #38e986;
    --faq-blue: #4aa3ff;
    --faq-shadow: 0 28px 80px rgba(0,0,0,.42);
    --faq-radius: 28px;
  }
  .faq-page { width: min(1520px, calc(100% - 36px)); margin: 0 auto; padding: 34px 0 0; }
  .faq-hero { position: relative; overflow: hidden; border: 1px solid var(--faq-border); border-radius: 34px; background: linear-gradient(135deg, color-mix(in srgb, var(--faq-card) 94%, transparent), color-mix(in srgb, var(--faq-card) 72%, #1d2433)), radial-gradient(circle at 18% 18%, color-mix(in srgb, var(--faq-accent) 24%, transparent), transparent 34%); box-shadow: var(--faq-shadow); padding: 42px; min-height: 360px; isolation: isolate; animation: faqFloatIn .65s ease both; }
  .faq-hero::before { content: ""; position: absolute; inset: -1px; background: linear-gradient(110deg, transparent 0 36%, rgba(255,255,255,.08) 48%, transparent 62%); transform: translateX(-42%); animation: faqShine 8s ease-in-out infinite; z-index: -1; }
  .faq-hero::after { content: ""; position: absolute; right: -12%; top: -24%; width: 520px; height: 520px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--faq-blue) 24%, transparent), transparent 66%); filter: blur(8px); z-index: -1; }
  .faq-hero-grid { display: grid; grid-template-columns: minmax(0,1.12fr) minmax(320px,.88fr); gap: 32px; align-items: center; }
  .faq-kicker { display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px; border: 1px solid color-mix(in srgb, var(--faq-accent) 55%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--faq-accent) 12%, transparent); color: var(--faq-accent); font-size: .84rem; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
  .faq-title { margin: 20px 0 12px; font-size: clamp(42px,6vw,88px); line-height: .92; letter-spacing: -.06em; color: var(--faq-text); }
  .faq-title span { display: block; color: var(--faq-accent); text-shadow: 0 12px 40px color-mix(in srgb, var(--faq-accent) 28%, transparent); }
  .faq-subtitle { max-width: 780px; color: var(--faq-muted); font-size: clamp(16px,1.5vw,22px); line-height: 1.75; font-weight: 700; margin: 0 0 26px; }
  .faq-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
  .faq-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border-radius: 18px; padding: 14px 20px; font-weight: 800; border: 1px solid var(--faq-border); transition: .22s ease; min-height: 52px; font-family: inherit; font-size: inherit; cursor: pointer; text-decoration: none; }
  .faq-btn.primary { background: linear-gradient(135deg, #08b84f, var(--faq-accent2)); color: #160f02; border-color: transparent; box-shadow: 0 18px 40px color-mix(in srgb, var(--faq-accent) 22%, transparent); }
  .faq-btn.ghost { background: color-mix(in srgb, var(--faq-card2) 82%, transparent); color: var(--faq-text); }
  .faq-btn:hover { transform: translateY(-2px); filter: saturate(1.05); }
  .faq-visual { position: relative; border: 1px solid var(--faq-border); border-radius: 30px; min-height: 300px; overflow: hidden; background: linear-gradient(180deg, color-mix(in srgb, #151923 80%, transparent), #07080b); box-shadow: 0 20px 60px rgba(0,0,0,.28); }
  .faq-visual img { width: 100%; height: 100%; min-height: 300px; object-fit: cover; opacity: .82; filter: saturate(1.05) contrast(1.05); }
  .faq-visual::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 24%, rgba(0,0,0,.78)); }
  .faq-visual-badge { position: absolute; left: 22px; bottom: 22px; right: 22px; z-index: 2; border: 1px solid rgba(255,255,255,.16); background: rgba(9,10,14,.74); backdrop-filter: blur(16px); border-radius: 22px; padding: 18px; }
  .faq-visual-badge strong { display: block; font-size: 22px; color: #eef6ff; margin-bottom: 4px; }
  .faq-visual-badge span { color: #08b84f; font-weight: 800; }
  .faq-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 16px; margin: 22px 0; }
  .faq-stat { border: 1px solid var(--faq-border); border-radius: 24px; padding: 20px; background: linear-gradient(135deg, color-mix(in srgb, var(--faq-card) 95%, transparent), color-mix(in srgb, var(--faq-card2) 88%, transparent)); box-shadow: 0 14px 44px rgba(0,0,0,.16); position: relative; overflow: hidden; animation: faqUp .55s ease both; }
  .faq-stat:nth-child(2) { animation-delay: .06s; }
  .faq-stat:nth-child(3) { animation-delay: .12s; }
  .faq-stat:nth-child(4) { animation-delay: .18s; }
  .faq-stat::after { content: ""; position: absolute; right: -30px; bottom: -58px; width: 170px; height: 88px; background: linear-gradient(135deg, transparent, color-mix(in srgb, var(--faq-accent) 22%, transparent)); transform: rotate(-10deg); }
  .faq-stat .ico { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; background: color-mix(in srgb, var(--faq-accent) 22%, transparent); margin-bottom: 16px; font-size: 22px; }
  .faq-stat strong { display: block; font-size: 32px; color: var(--faq-text); letter-spacing: -.04em; }
  .faq-stat span { display: block; color: var(--faq-muted); font-weight: 800; margin-top: 4px; }
  .faq-control { position: sticky; top: 14px; z-index: 20; border: 1px solid var(--faq-border); border-radius: 28px; padding: 16px; background: color-mix(in srgb, var(--faq-card) 88%, transparent); backdrop-filter: blur(22px); box-shadow: 0 18px 50px rgba(0,0,0,.22); display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; margin: 22px 0; }
  .faq-search { display: flex; align-items: center; gap: 12px; background: color-mix(in srgb, var(--faq-page) 62%, transparent); border: 1px solid var(--faq-border); border-radius: 20px; padding: 0 16px; min-height: 56px; }
  .faq-search input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--faq-text); font: inherit; font-weight: 800; }
  .faq-search input::placeholder { color: color-mix(in srgb, var(--faq-muted) 70%, transparent); }
  .faq-chips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
  .faq-chip { border: 1px solid var(--faq-border); background: color-mix(in srgb, var(--faq-card2) 72%, transparent); color: var(--faq-muted); padding: 12px 14px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 900; cursor: pointer; transition: .2s ease; }
  .faq-chip.active, .faq-chip:hover { background: linear-gradient(135deg, #08b84f, var(--faq-accent2)); color: #160f02; border-color: transparent; box-shadow: 0 14px 32px color-mix(in srgb, var(--faq-accent) 18%, transparent); }
  .faq-content { display: grid; grid-template-columns: minmax(0,1fr) 360px; gap: 20px; align-items: start; }
  .faq-panel, .faq-side-card, .faq-cta { border: 1px solid var(--faq-border); border-radius: var(--faq-radius); background: linear-gradient(145deg, color-mix(in srgb, var(--faq-card) 96%, transparent), color-mix(in srgb, var(--faq-card2) 82%, transparent)); box-shadow: var(--faq-shadow); }
  .faq-panel { padding: 22px; }
  .faq-panel-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
  .faq-panel-head h2 { font-size: clamp(26px,2.5vw,42px); margin: 0 0 6px; letter-spacing: -.04em; }
  .faq-panel-head p { margin: 0; color: var(--faq-muted); font-weight: 800; }
  .faq-count { white-space: nowrap; padding: 10px 14px; border-radius: 999px; background: color-mix(in srgb, var(--faq-accent) 14%, transparent); color: var(--faq-accent); font-weight: 900; border: 1px solid color-mix(in srgb, var(--faq-accent) 28%, transparent); }
  .faq-list { display: grid; gap: 10px; }
  .faq-item { border: 1px solid var(--faq-border); border-radius: 22px; background: color-mix(in srgb, var(--faq-page) 44%, transparent); overflow: hidden; }
  .faq-q { width: 100%; display: grid; grid-template-columns: 52px 1fr 36px; align-items: center; gap: 12px; padding: 16px; border: 0; background: transparent; color: var(--faq-text); text-align: left; font: inherit; font-weight: 900; cursor: pointer; }
  .faq-q .num { width: 42px; height: 42px; border-radius: 16px; display: grid; place-items: center; background: linear-gradient(135deg, #08b84f, var(--faq-accent2)); color: #160f02; font-size: 14px; }
  .faq-q .plus { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; background: color-mix(in srgb, var(--faq-card2) 78%, transparent); color: var(--faq-accent); font-size: 22px; transition: transform .25s ease; }
  .faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .25s ease; }
  .faq-a-inner { overflow: hidden; color: var(--faq-muted); font-weight: 700; line-height: 1.8; padding: 0 18px; }
  .faq-item.active .faq-a { grid-template-rows: 1fr; }
  .faq-item.active .faq-a-inner { padding: 0 18px 18px 80px; }
  .faq-item.active .plus { transform: rotate(45deg); }
  .faq-empty { display: none; text-align: center; color: var(--faq-muted); font-weight: 800; border: 1px dashed var(--faq-border); border-radius: 20px; padding: 22px; }
  .faq-empty.show { display: block; }
  .faq-side { display: grid; gap: 16px; position: sticky; top: 112px; }
  .faq-side-card { padding: 22px; }
  .faq-side-card h3 { font-size: 24px; margin: 0 0 8px; }
  .faq-side-card p { color: var(--faq-muted); font-weight: 700; line-height: 1.75; margin: 0 0 16px; }
  .faq-side-list { display: grid; gap: 10px; }
  .faq-side-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 18px; border: 1px solid var(--faq-border); background: color-mix(in srgb, var(--faq-page) 44%, transparent); font-weight: 900; color: var(--faq-text); text-decoration: none; transition: .18s ease; }
  .faq-side-row:hover { border-color: color-mix(in srgb, var(--faq-accent) 40%, transparent); background: color-mix(in srgb, var(--faq-accent) 8%, transparent); }
  .faq-side-row span { width: 38px; height: 38px; border-radius: 14px; display: grid; place-items: center; background: color-mix(in srgb, var(--faq-accent) 18%, transparent); }
  .faq-cta { margin: 22px 0 0; padding: 28px; display: flex; justify-content: space-between; gap: 18px; align-items: center; background: linear-gradient(135deg, color-mix(in srgb, var(--faq-accent) 16%, var(--faq-card)), color-mix(in srgb, var(--faq-card) 92%, transparent)); }
  .faq-cta h2 { margin: 0 0 8px; font-size: clamp(26px,3vw,44px); letter-spacing: -.04em; }
  .faq-cta p { margin: 0; color: var(--faq-muted); font-weight: 800; line-height: 1.7; max-width: 840px; }
  .faq-footer { margin-top: 22px; border-top: 1px solid var(--faq-border); padding: 28px 0; color: var(--faq-muted); }
  .faq-footer-grid { display: grid; grid-template-columns: 1.2fr repeat(3,1fr); gap: 18px; }
  .faq-footer img { width: 170px; margin-bottom: 12px; }
  .faq-footer p { font-weight: 700; line-height: 1.7; }
  .faq-footer h4 { margin: 0 0 12px; color: var(--faq-text); }
  .faq-footer a { display: block; margin: 8px 0; font-weight: 800; color: var(--faq-muted); text-decoration: none; transition: color .18s; }
  .faq-footer a:hover { color: var(--faq-accent); }
  @keyframes faqShine { 0%,70%,100% { transform: translateX(-58%); } 82% { transform: translateX(58%); } }
  @keyframes faqFloatIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes faqUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @media (max-width: 1100px) {
    .faq-hero-grid, .faq-content { grid-template-columns: 1fr; }
    .faq-side { position: static; }
    .faq-stats { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .faq-footer-grid { grid-template-columns: 1fr 1fr; }
    .faq-control { grid-template-columns: 1fr; }
    .faq-chips { justify-content: flex-start; }
  }
  @media (max-width: 640px) {
    .faq-page { width: min(calc(100% - 22px),1520px); padding-top: 18px; }
    .faq-hero { padding: 24px; border-radius: 26px; }
    .faq-title { font-size: 42px; }
    .faq-stats { grid-template-columns: 1fr; }
    .faq-panel { padding: 14px; }
    .faq-panel-head, .faq-cta { display: block; }
    .faq-count { display: inline-flex; margin-top: 12px; }
    .faq-q { grid-template-columns: 44px 1fr 32px; padding: 13px; }
    .faq-q .num { width: 36px; height: 36px; }
    .faq-item.active .faq-a-inner { padding: 0 14px 16px 14px; }
    .faq-footer-grid { grid-template-columns: 1fr; }
    .faq-btn { width: 100%; }
    .faq-visual, .faq-visual img { min-height: 240px; }
  }
`;

const FAQS = [
  { cat: 'package', q: 'Bonustime คืออะไร?', a: 'Bonustime คือบริการจัดการแพ็กเกจโบนัสไทม์ผ่าน RTAUTOBOT ผู้ใช้สามารถเลือกแพ็กเกจ เติมเครดิต สั่งซื้อ และติดตามสถานะได้จากระบบเดียว' },
  { cat: 'package', q: 'ควรเลือกแพ็กเกจ Bonustime แบบไหนดี?', a: 'ให้เลือกตามรูปแบบการใช้งาน ระยะเวลาที่ต้องการ และรายละเอียดของแพ็กเกจที่แสดงในหน้า Bonustime ก่อนยืนยันรายการทุกครั้ง' },
  { cat: 'package', q: 'ต่ออายุ Bonustime ได้ไหม?', a: 'สามารถต่ออายุได้เมื่อมีแพ็กเกจที่เปิดให้ใช้งานในระบบ แนะนำตรวจสอบรายละเอียดแพ็กเกจและยอดเครดิตก่อนยืนยันรายการ' },
  { cat: 'package', q: 'อัปเกรดแพ็กเกจ Bonustime ได้หรือไม่?', a: 'สามารถเลือกแพ็กเกจที่ต้องการอัปเกรดได้ตามตัวเลือกที่ระบบเปิดให้บริการ หากไม่แน่ใจให้ตรวจสอบรายละเอียดก่อนทำรายการ' },
  { cat: 'credit', q: 'ต้องเติมเครดิตก่อนสั่งซื้อ Bonustime ไหม?', a: 'ควรเติมเครดิตให้เพียงพอก่อนสั่งซื้อ เพื่อให้ระบบสามารถหักยอดและสร้างรายการได้ทันทีโดยไม่สะดุด' },
  { cat: 'credit', q: 'เติมเครดิตแล้วต้องรอนานแค่ไหน?', a: 'โดยทั่วไปเมื่อชำระถูกต้องและระบบตรวจสอบรายการเรียบร้อย เครดิตจะเข้าสู่บัญชีอัตโนมัติ หากยอดยังไม่เข้าให้ตรวจสอบประวัติเติมเงินหรือติดต่อทีมงาน' },
  { cat: 'credit', q: 'เติมเครดิตผิดยอดต้องทำอย่างไร?', a: 'ให้ติดต่อทีมงานพร้อมหลักฐานการชำระเงินและข้อมูลรายการ เพื่อให้ตรวจสอบและช่วยดำเนินการตามเงื่อนไขของระบบ' },
  { cat: 'order', q: 'สั่งซื้อ Bonustime ได้จากหน้าไหน?', a: 'เข้าสู่ระบบแล้วไปที่หน้า Bonustime เลือกแพ็กเกจ ตรวจสอบรายละเอียดและยอดเครดิต จากนั้นกดยืนยันรายการ' },
  { cat: 'order', q: 'จะดูสถานะรายการ Bonustime ได้อย่างไร?', a: 'ดูสถานะและประวัติได้จากหน้า Bonustime History หรือเมนูประวัติที่เกี่ยวข้องหลังเข้าสู่ระบบ' },
  { cat: 'order', q: 'คำสั่งซื้อ Bonustime ใช้เวลานานไหม?', a: 'ระยะเวลาดำเนินการขึ้นอยู่กับแพ็กเกจและสถานะระบบในช่วงเวลานั้น แนะนำติดตามสถานะจากหน้าประวัติรายการ' },
  { cat: 'order', q: 'ยกเลิกรายการ Bonustime ได้ไหม?', a: 'การยกเลิกขึ้นอยู่กับสถานะและเงื่อนไขของรายการ หากระบบเริ่มดำเนินการแล้วบางรายการอาจไม่สามารถยกเลิกได้' },
  { cat: 'order', q: 'หากรายการไม่สำเร็จ เครดิตจะคืนไหม?', a: 'หากรายการเข้าเงื่อนไขที่ไม่สามารถดำเนินการได้ ระบบหรือทีมงานจะตรวจสอบและจัดการยอดเครดิตตามเงื่อนไขของบริการ' },
  { cat: 'account', q: 'สมัครสมาชิกต้องใช้อะไรบ้าง?', a: 'ใช้ข้อมูลบัญชีตามที่ระบบกำหนด เช่น ชื่อผู้ใช้ อีเมล และรหัสผ่าน จากนั้นเข้าสู่ระบบเพื่อเติมเครดิตและใช้งาน Bonustime ได้' },
  { cat: 'account', q: 'ลืมรหัสผ่านต้องทำอย่างไร?', a: 'ไปที่หน้าเข้าสู่ระบบแล้วเลือกเมนูลืมรหัสผ่าน ทำตามขั้นตอนยืนยันตัวตน หรือแจ้งทีมงานหากไม่สามารถดำเนินการเองได้' },
  { cat: 'account', q: 'ควรตรวจสอบอะไรก่อนยืนยันรายการ?', a: 'ควรตรวจสอบแพ็กเกจ ระยะเวลา ยอดเครดิต รายละเอียดบริการ และบัญชีผู้ใช้ให้ถูกต้องก่อนยืนยันรายการทุกครั้ง' },
];

export default function FaqPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState(new Set());

  const visibleFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQS.map((faq, idx) => {
      const okCat = activeFilter === 'all' || faq.cat === activeFilter;
      const okText = !q || (faq.q + ' ' + faq.a).toLowerCase().includes(q);
      return { ...faq, idx, visible: okCat && okText };
    });
  }, [activeFilter, searchQuery]);

  const shownCount = visibleFaqs.filter(f => f.visible).length;

  const toggleItem = (idx) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const chips = [
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'แพ็กเกจ', value: 'package' },
    { label: 'เติมเครดิต', value: 'credit' },
    { label: 'คำสั่งซื้อ', value: 'order' },
    { label: 'บัญชี', value: 'account' },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="faq-page">
        {/* Hero */}
        <section className="faq-hero" aria-label="Bonustime FAQ hero">
          <div className="faq-hero-grid">
            <div>
              <div className="faq-kicker">✦ FAQ</div>
              <h1 className="faq-title">คำถามที่พบบ่อย <span>Bonustime</span></h1>
              <p className="faq-subtitle">รวมคำตอบสำคัญสำหรับการใช้งาน Bonustime ตั้งแต่เลือกแพ็กเกจ เติมเครดิต สั่งซื้อ ต่ออายุ อัปเกรด ไปจนถึงตรวจสอบสถานะรายการ อ่านง่าย ตรงประเด็น และพร้อมใช้งานจริง</p>
              <div className="faq-actions">
                <a className="faq-btn primary" href="/bonustime">เริ่มสั่งซื้อ Bonustime →</a>
                <a className="faq-btn ghost" href="/bonustime">ดูประวัติ Bonustime</a>
              </div>
            </div>
            <div className="faq-visual">
              <img src="/assets/img/main-pic.png" alt="RTAUTOBOT Bonustime" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div className="faq-visual-badge">
                <strong>Bonustime Support</strong>
                <span>คู่มือสั้น กระชับ สำหรับการใช้งานแพ็กเกจโบนัสไทม์</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="faq-stats" aria-label="Bonustime FAQ highlights">
          <div className="faq-stat"><div className="ico">⚡</div><strong>รวดเร็ว</strong><span>เลือกแพ็กเกจและยืนยันรายการได้ทันที</span></div>
          <div className="faq-stat"><div className="ico">💳</div><strong>เครดิต</strong><span>เติมเครดิตแล้วใช้สั่งซื้อ Bonustime ได้สะดวก</span></div>
          <div className="faq-stat"><div className="ico">📦</div><strong>แพ็กเกจ</strong><span>รองรับการเลือกแพ็กเกจตามรูปแบบที่เปิดให้บริการ</span></div>
          <div className="faq-stat"><div className="ico">🛡️</div><strong>ติดตามได้</strong><span>ตรวจสอบสถานะและประวัติรายการในระบบ</span></div>
        </section>

        {/* Control */}
        <section className="faq-control" aria-label="FAQ controls">
          <label className="faq-search" htmlFor="faqSearch">
            <span>🔍</span>
            <input
              id="faqSearch"
              type="search"
              placeholder="ค้นหา เช่น Bonustime, เติมเครดิต, ต่ออายุ, อัปเกรด, สถานะ..."
              autoComplete="off"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </label>
          <div className="faq-chips" role="tablist" aria-label="หมวด FAQ">
            {chips.map(chip => (
              <button
                key={chip.value}
                className={`faq-chip${activeFilter === chip.value ? ' active' : ''}`}
                type="button"
                onClick={() => setActiveFilter(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </section>

        {/* Content */}
        <section className="faq-content">
          <div className="faq-panel">
            <div className="faq-panel-head">
              <div>
                <h2>ศูนย์รวมคำตอบ Bonustime</h2>
                <p>กดเปิดอ่านทีละข้อ หรือใช้ช่องค้นหาเพื่อกรองคำถามที่ต้องการ</p>
              </div>
              <span className="faq-count">{shownCount.toLocaleString('th-TH')} รายการ</span>
            </div>
            <div className="faq-list">
              {visibleFaqs.map(({ idx, q, a, visible }) => {
                const isOpen = openItems.has(idx);
                return (
                  <article
                    key={idx}
                    className={`faq-item${isOpen ? ' active' : ''}`}
                    hidden={!visible}
                    data-cat={FAQS[idx].cat}
                  >
                    <button
                      className="faq-q"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleItem(idx)}
                    >
                      <span className="num">{String(idx + 1).padStart(2, '0')}</span>
                      <span>{q}</span>
                      <span className="plus">+</span>
                    </button>
                    <div className="faq-a">
                      <div className="faq-a-inner">{a}</div>
                    </div>
                  </article>
                );
              })}
              <div className={`faq-empty${shownCount === 0 ? ' show' : ''}`}>
                ไม่พบคำถามที่ตรงกับคำค้น ลองใช้คำสั้นลง เช่น &quot;เติมเครดิต&quot; หรือ &quot;ต่ออายุ&quot;
              </div>
            </div>
          </div>

          <aside className="faq-side" aria-label="Quick help">
            <div className="faq-side-card">
              <h3>ทางลัด Bonustime</h3>
              <p>เมนูสำคัญสำหรับเริ่มใช้งานและตรวจสอบรายการได้เร็วขึ้น</p>
              <div className="faq-side-list">
                <a className="faq-side-row" href="/bonustime"><span>🛒</span>สั่งซื้อ Bonustime</a>
                <a className="faq-side-row" href="/bonustime"><span>📦</span>ประวัติ Bonustime</a>
                <a className="faq-side-row" href="/topup"><span>💳</span>เติมเครดิต</a>
                <a className="faq-side-row" href="/account"><span>👤</span>บัญชีของฉัน</a>
              </div>
            </div>
            <div className="faq-side-card">
              <h3>ก่อนยืนยันรายการ</h3>
              <p>ตรวจสอบแพ็กเกจ ระยะเวลา ยอดเครดิต และรายละเอียดให้ครบ เพื่อให้การใช้งาน Bonustime เป็นไปอย่างราบรื่น</p>
              <a className="faq-btn primary" href="/bonustime" style={{ width: '100%' }}>เปิดหน้า Bonustime</a>
            </div>
          </aside>
        </section>

        {/* CTA */}
        <section className="faq-cta">
          <div>
            <h2>พร้อมเริ่มใช้งาน Bonustime แล้วใช่ไหม?</h2>
            <p>เข้าสู่ระบบ เติมเครดิต เลือกแพ็กเกจที่ต้องการ และติดตามสถานะรายการได้จากหน้า Bonustime ของคุณ</p>
          </div>
          <div className="faq-actions">
            <a className="faq-btn primary" href="/bonustime">สั่งซื้อ Bonustime</a>
            <a className="faq-btn ghost" href="/login">เข้าสู่ระบบ</a>
          </div>
        </section>

        {/* Footer */}
        <footer className="faq-footer">
          <div className="faq-footer-grid">
            <div>
              <img src="/assets/logo/logo-rtautobot.png" alt="RTAUTOBOT" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <p>RTAUTOBOT ศูนย์บริการ Bonustime สำหรับผู้ใช้ที่ต้องการจัดการแพ็กเกจ เติมเครดิต และติดตามสถานะได้สะดวกในที่เดียว</p>
            </div>
            <div>
              <h4>บริการ</h4>
              <a href="/">หน้าแรก</a>
              <a href="/bonustime">Bonustime</a>
              <a href="/bonustime">ประวัติ Bonustime</a>
            </div>
            <div>
              <h4>บัญชีและเครดิต</h4>
              <a href="/topup">เติมเครดิต</a>
              <a href="/wallet">กระเป๋าเครดิต</a>
              <a href="/account">บัญชีของฉัน</a>
            </div>
            <div>
              <h4>ช่วยเหลือ</h4>
              <a href="/faq">คำถามที่พบบ่อย</a>
              <a href="/support">ติดต่อทีมงาน</a>
              <a href="/page/terms-of-use">เงื่อนไขและข้อตกลง</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
