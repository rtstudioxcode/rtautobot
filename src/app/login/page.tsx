'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { notifyFromPayload } from '../../lib/clientNotify';
import SvgIcon from '@/components/SvgIcon';
import TurnstileWidget from '@/components/TurnstileWidget';



const loginStyles = `
        .rtx-login{position:relative;min-height:100vh;display:grid;place-items:center;padding:clamp(22px,4vw,54px);overflow:hidden;isolation:isolate;color:#eef6ff;}
        .rtx-bg{position:absolute;inset:0;z-index:-3;background:radial-gradient(circle at 15% 28%,rgba(8,184,79,0.32),transparent 31%),radial-gradient(circle at 92% 78%,rgba(61,137,255,0.20),transparent 34%),linear-gradient(135deg,rgba(7,8,11,0.92),#07080c);}
        .rtx-grid{position:absolute;inset:-1px;background-image:linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at 50% 50%,#000 0 45%,transparent 72%);opacity:.36;z-index:-2;}
        .rtx-orb{position:absolute;border-radius:50%;filter:blur(34px);opacity:.56;animation:rtxFloat 9s ease-in-out infinite alternate;}
        .rtx-orb-1{width:270px;height:270px;background:rgba(8,184,79,0.42);left:7%;top:22%;}
        .rtx-orb-2{width:340px;height:340px;background:rgba(54,134,255,0.18);right:7%;bottom:8%;animation-delay:-2.5s;}
        .rtx-orb-3{width:210px;height:210px;background:rgba(147,94,255,0.15);left:50%;bottom:2%;animation-delay:-5s;}
        .rtx-shell{width:min(1220px,100%);display:grid;grid-template-columns:minmax(0,1.08fr) minmax(390px,.72fr);gap:28px;align-items:center;}
        .rtx-panel{position:relative;border:1px solid rgba(255,255,255,0.10);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.022)),rgba(17,18,24,0.92);box-shadow:0 30px 90px rgba(0,0,0,0.48),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(18px);overflow:hidden;}
        .rtx-hero{border-radius:34px;padding:clamp(34px,4.8vw,62px);min-height:500px;display:flex;flex-direction:column;justify-content:center;}
        .rtx-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(116deg,transparent 0 50%,rgba(255,255,255,.07) 50% 61%,transparent 61%);pointer-events:none;}
        .rtx-hero>*{position:relative;z-index:1;}
        .rtx-pill{display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:999px;border:1px solid rgba(8,184,79,0.52);background:rgba(8,184,79,0.12);color:#08b84f;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;}
        .rtx-hero h1{max-width:780px;margin:26px 0 16px;font-size:clamp(42px,5.2vw,68px);line-height:1.02;letter-spacing:-.06em;}
        .rtx-lead{max-width:740px;margin:0;color:#08b84f;font-size:clamp(15px,1.4vw,19px);line-height:1.82;font-weight:700;}
        .rtx-feature-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:42px;}
        .rtx-feature{min-height:130px;border:1px solid rgba(255,255,255,0.08);border-radius:24px;background:rgba(255,255,255,0.06);padding:16px;display:flex;flex-direction:column;justify-content:center;transition:transform .24s,border-color .24s;}
        .rtx-feature:hover{transform:translateY(-4px);border-color:rgba(8,184,79,0.52);}
        .rtx-feature-icon{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#21b95c,#05b84f);box-shadow:0 12px 28px rgba(8,184,79,0.22);margin-bottom:12px;font-size:20px;}
        .rtx-feature strong{font-size:14px;color:#eef6ff;}
        .rtx-feature small{margin-top:5px;color:rgba(8,184,79,0.8);line-height:1.5;font-size:12px;font-weight:700;}
        .rtx-meta{margin-top:auto;padding-top:34px;display:flex;align-items:center;flex-wrap:wrap;gap:10px;color:rgba(8,184,79,0.72);font-size:12px;font-weight:800;}
        .rtx-meta i{width:5px;height:5px;border-radius:50%;background:#08b84f;opacity:.7;}
        .rtx-card{justify-self:center;width:100%;max-width:500px;border-radius:30px;padding:32px;}
        .rtx-card::before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,#08b84f,transparent);opacity:.5;}
        .rtx-card-glow{position:absolute;right:-28%;bottom:-34%;width:300px;height:300px;background:radial-gradient(circle,rgba(8,184,79,0.24),transparent 66%);filter:blur(22px);pointer-events:none;}
        .rtx-card-head{position:relative;display:flex;align-items:center;gap:16px;margin-bottom:24px;}
        .rtx-lock{width:56px;height:56px;flex:0 0 56px;border-radius:19px;display:grid;place-items:center;background:linear-gradient(135deg,#08b84f,#05b84f);box-shadow:0 16px 38px rgba(8,184,79,0.26);font-size:26px;}
        .rtx-card-head h2{margin:0 0 6px;font-size:30px;line-height:1;letter-spacing:-.045em;color:#eef6ff;}
        .rtx-card-head p{margin:0;color:#08b84f;font-weight:800;font-size:14px;}
        .rtx-alert{margin:0 0 18px;padding:12px 14px;border-radius:16px;border:1px solid rgba(255,95,115,0.32);background:rgba(255,95,115,0.12);color:#ffb6bf;font-weight:800;font-size:14px;}
        .rtx-form{display:grid;gap:16px;}
        .rtx-field{display:grid;gap:8px;}
        .rtx-label{font-size:13px;font-weight:800;color:rgba(8,184,79,0.9);}
        .rtx-inputbox{position:relative;width:100%;min-height:56px;border:1px solid rgba(255,255,255,0.10);border-radius:18px;background:rgba(7,8,11,0.7);display:grid;grid-template-columns:50px minmax(0,1fr) auto;align-items:center;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);transition:border-color .18s,box-shadow .18s,transform .18s;}
        .rtx-inputbox:focus-within{border-color:rgba(8,184,79,0.65);box-shadow:0 0 0 4px rgba(8,184,79,0.14);transform:translateY(-1px);}
        .rtx-input-icon{width:50px;height:56px;display:grid;place-items:center;background:rgba(0,0,0,0.18);color:#08b84f;font-weight:800;font-size:17px;}
        .rtx-inputbox input{width:100%;min-width:0;height:56px;border:0;outline:0;background:transparent;color:#eef6ff;font:inherit;font-weight:700;padding:0 14px;font-size:15px;}
        .rtx-inputbox input::placeholder{color:rgba(255,255,255,0.28);}
        .rtx-pass{width:42px;height:42px;margin-right:6px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;background:rgba(255,255,255,0.07);color:#eef6ff;cursor:pointer;display:grid;place-items:center;transition:transform .18s,border-color .18s;font-size:17px;}
        .rtx-pass:hover{transform:translateY(-1px);border-color:rgba(8,184,79,0.55);}
        .rtx-submit{height:58px;border:0;border-radius:18px;background:linear-gradient(135deg,#08b84f,#08b84f 55%,#05b84f);color:#17130a;font-size:16px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 18px 44px rgba(8,184,79,0.28);transition:transform .2s,filter .2s;}
        .rtx-submit:hover{transform:translateY(-2px);filter:saturate(1.05);}
        .rtx-submit:disabled{opacity:.66;pointer-events:none;}
        .rtx-submit b{font-size:22px;}
        .rt-turnstile{display:grid;gap:8px;justify-items:center;padding:2px 0 0;}
        .rt-turnstile-box{min-height:65px;display:grid;place-items:center;}
        .rt-turnstile-hint,.rt-turnstile-error{width:100%;text-align:center;font-size:12px;font-weight:800;line-height:1.45;}
        .rt-turnstile-hint{color:rgba(8,184,79,0.8);}
        .rt-turnstile-error{color:#ffb6bf;}
        .rtx-links{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#08b84f;font-size:13px;font-weight:800;}
        .rtx-links a,.rtx-links button{color:#08b84f;font:inherit;font-weight:800;text-decoration:none;background:none;border:0;padding:0;cursor:pointer;transition:opacity .15s;}
        .rtx-links a:hover,.rtx-links button:hover{opacity:.7;}
        @media(max-width:860px){.rtx-shell{grid-template-columns:1fr}.rtx-hero{display:none}}
        @media(max-width:480px){.rtx-card{padding:22px;}}

        /* Forgot password modal */
        .rtx-forgot-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;}
        .rtx-forgot-bg{position:absolute;inset:0;background:rgba(0,0,0,0.74);backdrop-filter:blur(18px);animation:rtxFloat .32s ease both;}
        .rtx-forgot-card{position:relative;width:min(540px,100%);border:1px solid rgba(8,184,79,0.22);border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02)),#111218;padding:30px;box-shadow:0 40px 100px rgba(0,0,0,0.6);}
        .rtx-forgot-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px;}
        .rtx-forgot-badge{width:54px;height:54px;flex:0 0 54px;border-radius:18px;background:linear-gradient(135deg,#08b84f,#05b84f);display:grid;place-items:center;font-size:26px;box-shadow:0 14px 34px rgba(8,184,79,0.24);}
        .rtx-forgot-kicker{font-size:11px;font-weight:800;color:#08b84f;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;}
        .rtx-forgot-heading{display:block;font-size:24px;font-weight:800;color:#eef6ff;letter-spacing:-.03em;}
        .rtx-forgot-copy{display:block;color:#08b84f;font-size:13px;font-weight:700;margin-top:4px;line-height:1.6;}
        .rtx-forgot-steps{display:grid;gap:10px;margin:18px 0;}
        .rtx-forgot-step{display:flex;gap:14px;align-items:flex-start;padding:14px;border:1px solid rgba(255,255,255,0.07);border-radius:16px;background:rgba(255,255,255,0.04);}
        .rtx-forgot-no{min-width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#08b84f,#05b84f);color:#17130a;font-weight:800;font-size:13px;display:grid;place-items:center;flex:0 0 36px;}
        .rtx-forgot-step strong{display:block;font-size:14px;color:#eef6ff;margin-bottom:3px;}
        .rtx-forgot-step small{color:#08b84f;font-size:12px;font-weight:700;line-height:1.5;}
        .rtx-forgot-email{display:grid;gap:8px;margin:18px 0;}
        .rtx-forgot-email span{font-size:13px;font-weight:800;color:rgba(8,184,79,0.9);}
        .rtx-forgot-inputwrap{display:flex;align-items:center;gap:12px;border:1px solid rgba(255,255,255,0.10);border-radius:16px;background:rgba(7,8,11,0.7);padding:0 14px;min-height:52px;transition:border-color .18s;}
        .rtx-forgot-inputwrap:focus-within{border-color:rgba(8,184,79,0.6);box-shadow:0 0 0 3px rgba(8,184,79,0.12);}
        .rtx-forgot-inputwrap input{flex:1;border:0;outline:0;background:transparent;color:#eef6ff;font:inherit;font-weight:700;font-size:14px;}
        .rtx-forgot-inputwrap input::placeholder{color:rgba(255,255,255,0.28);}
        .rtx-forgot-actions{display:flex;gap:12px;margin-top:4px;}
        .rtx-forgot-btn{flex:1;height:52px;border-radius:16px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .2s;}
        .rtx-forgot-btn.primary{border:0;background:linear-gradient(135deg,#08b84f,#05b84f);color:#17130a;box-shadow:0 14px 34px rgba(8,184,79,0.26);}
        .rtx-forgot-btn.primary:hover{transform:translateY(-2px);}
        .rtx-forgot-btn.primary:disabled{opacity:.6;pointer-events:none;}
        .rtx-forgot-btn.ghost{border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef6ff;}
        .rtx-forgot-btn.ghost:hover{background:rgba(255,255,255,0.10);}
        .rtx-forgot-msg{padding:11px 14px;border-radius:14px;font-size:13px;font-weight:700;margin-bottom:12px;}
        .rtx-forgot-msg.ok{background:rgba(8,184,79,0.12);border:1px solid rgba(8,184,79,0.28);color:#38e986;}
        .rtx-forgot-msg.err{background:rgba(255,95,115,0.12);border:1px solid rgba(255,95,115,0.28);color:#ffb6bf;}
      `;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';

  const [form, setForm] = useState({ login: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState(null);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('translate', 'no');
      document.body?.setAttribute('translate', 'no');
      document.documentElement.classList.add('notranslate');
      document.body?.classList.add('notranslate');
      if (!document.querySelector('meta[name="google"]')) {
        const meta = document.createElement('meta');
        meta.name = 'google';
        meta.content = 'notranslate';
        document.head.appendChild(meta);
      }
    } catch {}
  }, []);






  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (turnstileEnabled && !turnstileToken) {
      const msg = 'กรุณายืนยันความปลอดภัยก่อนเข้าสู่ระบบ';
      setError(msg);
      notifyFromPayload({ variant: 'error', title: 'ยืนยันความปลอดภัย', text: msg });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      const data = await res.json();
      if (!data.ok) { const msg = data.message || 'เข้าสู่ระบบไม่สำเร็จ'; setError(msg); setTurnstileResetKey(v => v + 1); notifyFromPayload({ variant: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', text: msg }); return; }
      router.push(nextPath);
      router.refresh();
    } catch {
      setTurnstileResetKey(v => v + 1);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); notifyFromPayload({ variant: 'error', title: 'เครือข่ายมีปัญหา', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    setForgotMsg(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const d = await res.json();
      if (d.ok) setForgotMsg({ ok: true, text: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว' });
      else setForgotMsg({ ok: false, text: d.message || 'ไม่พบอีเมลนี้ในระบบ' });
    } catch {
      setForgotMsg({ ok: false, text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />

      <section className="rtx-login">
        {/* Background */}
        <div className="rtx-bg" aria-hidden="true">
          <span className="rtx-orb rtx-orb-1" />
          <span className="rtx-orb rtx-orb-2" />
          <span className="rtx-orb rtx-orb-3" />
          <span className="rtx-grid" />
        </div>

        <div className="rtx-shell">
          {/* Left — Hero panel */}
          <section className="rtx-panel rtx-hero anim-rise" aria-label="ข้อมูล RTAUTOBOT">
            <div className="rtx-pill"><span><SvgIcon name="spark" size={18} /></span> RTAUTOBOT LOGIN ACCESS</div>
            <h1>เข้าสู่ระบบจัดการ Bonustime Automation</h1>
            <p className="rtx-lead">
              ระบบจัดการบอท LINE และแพ็กเกจ Bonustime สำหรับดูแลลูกค้า ติดตามออเดอร์ เติมเครดิต และใช้งานบริการอัตโนมัติในที่เดียว
            </p>
            <div className="rtx-feature-row" aria-label="จุดเด่นระบบ">
              {[
                { icon: 'zap', title: 'ทำงานรวดเร็ว', sub: 'อยู่ที่ไหนก็ใช้งานได้' },
                { icon: 'shield', title: 'ปลอดภัย', sub: 'ความปลอดภัยระดับสูงสุด' },
                { icon: 'chart', title: 'ครบในที่เดียว', sub: 'เติมเครดิตออโต้ สั่งซื้อ Bonustime ติดตามสถานะ และจัดการข้อมูลบัญชี' },
              ].map(({ icon, title, sub }) => (
                <div key={title} className="rtx-feature">
                  <div className="rtx-feature-icon"><SvgIcon name={icon} size={21} /></div>
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </div>
              ))}
            </div>
            <div className="rtx-meta">
              <span>All Right Reserved</span><i /><span>&copy; 2026</span><i /><span>RTAUTOBOT</span>
            </div>
          </section>

          {/* Right — Login card */}
          <section className="rtx-panel rtx-card anim-rise-2" aria-label="แบบฟอร์มเข้าสู่ระบบ">
            <div className="rtx-card-glow" aria-hidden="true" />
            <div className="rtx-card-head">
              <div className="rtx-lock"><SvgIcon name="lock" size={18} /></div>
              <div>
                <h2>เข้าสู่ระบบ</h2>
                <p>ระบบพร้อมให้บริการ 24 ชั่วโมง</p>
              </div>
            </div>

            {error && <div className="rtx-alert">{error}</div>}

            <form className="rtx-form" onSubmit={handleSubmit} noValidate>
              <label className="rtx-field">
                <span className="rtx-label">ชื่อผู้ใช้หรืออีเมล</span>
                <div className="rtx-inputbox">
                  <span className="rtx-input-icon"><SvgIcon name="user" size={18} /></span>
                  <input
                    name="username"
                    required
                    autoComplete="username"
                    placeholder="กรอกชื่อผู้ใช้หรืออีเมล"
                    value={form.login}
                    onChange={(e) => setForm({ ...form, login: e.target.value })}
                  />
                </div>
              </label>

              <label className="rtx-field">
                <span className="rtx-label">รหัสผ่าน</span>
                <div className="rtx-inputbox">
                  <span className="rtx-input-icon">••</span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="กรอกรหัสผ่าน"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="rtx-pass"
                    onClick={() => setShowPass(!showPass)}
                    aria-label="แสดงหรือซ่อนรหัสผ่าน"
                  >
                    <SvgIcon name={showPass ? "eyeOff" : "eye"} size={18} />
                  </button>
                </div>
              </label>

              <TurnstileWidget
                action="login"
                resetKey={turnstileResetKey}
                onEnabledChange={setTurnstileEnabled}
                onTokenChange={setTurnstileToken}
              />

              <button className="rtx-submit" type="submit" disabled={loading}>
                <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
                {!loading && <SvgIcon name="arrowRight" size={20} />}
              </button>

              <div className="rtx-links">
                <span>ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link></span>
                <button type="button" onClick={() => setForgotOpen(true)}>ลืมรหัสผ่าน?</button>
              </div>
            </form>
          </section>
        </div>
      </section>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="rtx-forgot-overlay">
          <div className="rtx-forgot-bg" onClick={() => setForgotOpen(false)} />
          <div className="rtx-forgot-card">
            <div className="rtx-forgot-head">
              <span className="rtx-forgot-badge"><SvgIcon name="lock" size={18} /></span>
              <div>
                <span className="rtx-forgot-kicker">PASSWORD RECOVERY</span>
                <span className="rtx-forgot-heading">รีเซ็ตรหัสผ่าน</span>
                <span className="rtx-forgot-copy">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณอย่างปลอดภัย</span>
              </div>
            </div>

            <div className="rtx-forgot-steps">
              {[
                { n: '01', t: 'ตรวจสอบอีเมลที่ผูกกับบัญชี', s: 'กรอกอีเมลเดียวกับที่ใช้สมัคร เพื่อให้ระบบตรวจสอบบัญชีได้ถูกต้อง' },
                { n: '02', t: 'ส่งลิงก์รีเซ็ตรหัสผ่านแบบใช้ครั้งเดียว', s: 'ลิงก์สำหรับตั้งรหัสผ่านใหม่จะถูกส่งไปยังอีเมลของคุณอย่างปลอดภัย' },
                { n: '03', t: 'ตั้งรหัสผ่านใหม่แล้วกลับมาเข้าสู่ระบบ', s: 'หลังตั้งรหัสผ่านสำเร็จ สามารถกลับมาเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที' },
              ].map(({ n, t, s }) => (
                <div key={n} className="rtx-forgot-step">
                  <span className="rtx-forgot-no">{n}</span>
                  <div><strong>{t}</strong><small>{s}</small></div>
                </div>
              ))}
            </div>

            {forgotMsg && (
              <div className={`rtx-forgot-msg ${forgotMsg.ok ? 'ok' : 'err'}`}>{forgotMsg.text}</div>
            )}

            <form onSubmit={handleForgot}>
              <label className="rtx-forgot-email">
                <span>อีเมลที่ผูกกับบัญชี</span>
                <div className="rtx-forgot-inputwrap">
                  <span><SvgIcon name="mail" size={18} /></span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
              </label>
              <div className="rtx-forgot-actions">
                <button type="button" className="rtx-forgot-btn ghost" onClick={() => { setForgotOpen(false); setForgotMsg(null); }}>ยกเลิก</button>
                <button type="submit" className="rtx-forgot-btn primary" disabled={forgotBusy}>
                  <span>{forgotBusy ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}</span>
                  {!forgotBusy && <SvgIcon name="arrowRight" size={18} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
