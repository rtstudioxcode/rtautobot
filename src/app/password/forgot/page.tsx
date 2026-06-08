'use client';

import { useState } from 'react';
import Link from 'next/link';
import { notifyFromPayload } from '../../../lib/clientNotify';
import SvgIcon from '@/components/SvgIcon';

const CSS = `
.fpw-page {
  min-height: 100vh; display: grid; place-items: center;
  padding: clamp(20px,4vw,52px); isolation: isolate; color: #eef6ff;
  background:
    radial-gradient(circle at 15% 28%,rgba(8,184,79,.28),transparent 30%),
    radial-gradient(circle at 88% 72%,rgba(61,137,255,.18),transparent 32%),
    linear-gradient(135deg,rgba(7,8,11,.94),#07080c);
}
.fpw-card {
  position: relative; width: min(540px,100%); overflow: hidden; border-radius: 30px;
  border: 1px solid rgba(124,255,178,.22);
  background:
    linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.02)),
    #111218;
  box-shadow: 0 40px 100px rgba(0,0,0,.56), inset 0 1px 0 rgba(255,255,255,.07);
  padding: 32px; animation: fpwIn .5s cubic-bezier(.2,.9,.2,1) both;
}
.fpw-card::before {
  content: ""; position: absolute; inset: 0 0 auto; height: 3px;
  background: linear-gradient(90deg, transparent, #08b84f, transparent); opacity: .85;
}
.fpw-head { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
.fpw-badge {
  width: 58px; height: 58px; flex: 0 0 58px; border-radius: 20px;
  display: grid; place-items: center;
  background: linear-gradient(135deg,#08b84f,#05b84f);
  box-shadow: 0 16px 36px rgba(8,184,79,.26); font-size: 26px;
  color: #17130a;
}
.fpw-kicker { color: #08b84f; font-size: 11px; font-weight: 950; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 4px; }
.fpw-heading { display: block; font-size: 26px; font-weight: 1000; color: #eef6ff; letter-spacing: -.04em; }
.fpw-copy { display: block; color: #08b84f; font-size: 13px; font-weight: 750; margin-top: 4px; line-height: 1.6; }
.fpw-steps { display: grid; gap: 10px; margin: 0 0 22px; }
.fpw-step {
  display: flex; gap: 14px; align-items: flex-start; padding: 14px;
  border: 1px solid rgba(255,255,255,.07); border-radius: 16px;
  background: rgba(255,255,255,.04);
}
.fpw-no {
  min-width: 36px; height: 36px; border-radius: 12px;
  background: linear-gradient(135deg,#08b84f,#05b84f); color: #17130a;
  font-weight: 950; font-size: 13px; display: grid; place-items: center; flex: 0 0 36px;
}
.fpw-step strong { display: block; font-size: 14px; color: #eef6ff; margin-bottom: 3px; }
.fpw-step small { color: #08b84f; font-size: 12px; font-weight: 750; line-height: 1.5; }
.fpw-field { display: grid; gap: 8px; margin: 0 0 16px; }
.fpw-label { font-size: 13px; font-weight: 900; color: rgba(8,184,79,.9); }
.fpw-inputwrap {
  display: flex; align-items: center; gap: 12px;
  border: 1px solid rgba(255,255,255,.10); border-radius: 16px;
  background: rgba(7,8,11,.7); padding: 0 14px; min-height: 52px;
  transition: border-color .18s ease, box-shadow .18s ease;
}
.fpw-inputwrap:focus-within { border-color: rgba(8,184,79,.6); box-shadow: 0 0 0 3px rgba(8,184,79,.12); }
.fpw-inputwrap input {
  flex: 1; border: 0; outline: 0; background: transparent; color: #eef6ff;
  font: inherit; font-weight: 750; font-size: 14px;
}
.fpw-inputwrap input::placeholder { color: rgba(255,255,255,.28); }
.fpw-msg { padding: 12px 14px; border-radius: 14px; font-size: 13px; font-weight: 750; margin-bottom: 14px; }
.fpw-msg.ok { background: rgba(8,184,79,.12); border: 1px solid rgba(8,184,79,.28); color: #38e986; }
.fpw-msg.err { background: rgba(255,95,115,.12); border: 1px solid rgba(255,95,115,.28); color: #ffb6bf; }
.fpw-success { text-align: center; }
.fpw-success-icon { font-size: 54px; margin-bottom: 16px; }
.fpw-success h2 { font-size: 22px; font-weight: 1000; color: #eef6ff; letter-spacing: -.03em; margin: 0 0 8px; }
.fpw-success p { color: #08b84f; font-size: 14px; font-weight: 750; line-height: 1.65; margin: 0 0 22px; }
.fpw-actions { display: flex; gap: 12px; }
.fpw-btn {
  flex: 1; height: 52px; border-radius: 16px; font-size: 14px; font-weight: 900;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 8px; transition: transform .2s ease, filter .2s ease; font-family: inherit;
  text-decoration: none;
}
.fpw-btn.primary { border: 0; background: linear-gradient(135deg,#08b84f,#05b84f); color: #17130a; box-shadow: 0 16px 36px rgba(8,184,79,.24); }
.fpw-btn.primary:hover { transform: translateY(-2px); filter: saturate(1.05); }
.fpw-btn.primary:disabled { opacity: .6; pointer-events: none; }
.fpw-btn.ghost { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.055); color: #eef6ff; }
.fpw-btn.ghost:hover { background: rgba(255,255,255,.10); }
.fpw-divider { border: 0; border-top: 1px solid rgba(255,255,255,.08); margin: 18px 0; }
.fpw-foot { text-align: center; font-size: 13px; color: rgba(238,246,255,.5); }
.fpw-foot a { color: #08b84f; text-decoration: none; font-weight: 800; }
.fpw-foot a:hover { text-decoration: underline; }
@keyframes fpwIn { from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)} }
`;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) { const msg = data.message || 'ไม่พบอีเมลนี้ในระบบ'; setError(msg); notifyFromPayload({ variant: 'error', title: 'ส่งลิงก์ไม่สำเร็จ', text: msg }); return; }
      setSent(true); notifyFromPayload({ variant: 'success', title: 'ส่งลิงก์แล้ว', text: 'โปรดตรวจสอบอีเมลของคุณ' });
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่'); notifyFromPayload({ variant: 'error', title: 'เครือข่ายมีปัญหา', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="fpw-page">
        <div className="fpw-card">
          <div className="fpw-head">
            <span className="fpw-badge"><SvgIcon name="lock" size={18} /></span>
            <div>
              <span className="fpw-kicker">PASSWORD RECOVERY</span>
              <span className="fpw-heading">รีเซ็ตรหัสผ่าน</span>
              <span className="fpw-copy">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้คุณ</span>
            </div>
          </div>

          {sent ? (
            <div className="fpw-success">
              <div className="fpw-success-icon"><SvgIcon name="mail" size={18} /></div>
              <h2>ส่งอีเมลแล้ว</h2>
              <p>ตรวจสอบอีเมลของคุณและคลิกลิงก์รีเซ็ตรหัสผ่าน<br/>ลิงก์จะหมดอายุใน 1 ชั่วโมง</p>
              <div className="fpw-actions">
                <Link href="/login" className="fpw-btn primary">กลับไปเข้าสู่ระบบ →</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="fpw-steps">
                {[
                  { n: '01', t: 'ตรวจสอบอีเมลที่ผูกกับบัญชี', s: 'กรอกอีเมลเดียวกับที่ใช้สมัคร' },
                  { n: '02', t: 'ส่งลิงก์รีเซ็ตรหัสผ่านแบบใช้ครั้งเดียว', s: 'ลิงก์จะถูกส่งไปยังอีเมลของคุณ' },
                  { n: '03', t: 'ตั้งรหัสผ่านใหม่แล้วกลับมาเข้าสู่ระบบ', s: 'หลังตั้งรหัสผ่านสำเร็จ ใช้ได้ทันที' },
                ].map(({ n, t, s }) => (
                  <div key={n} className="fpw-step">
                    <span className="fpw-no">{n}</span>
                    <div><strong>{t}</strong><small>{s}</small></div>
                  </div>
                ))}
              </div>

              {error && <div className="fpw-msg err">{error}</div>}

              <form onSubmit={handleSubmit}>
                <label className="fpw-field">
                  <span className="fpw-label">อีเมลที่ผูกกับบัญชี</span>
                  <div className="fpw-inputwrap">
                    <span><SvgIcon name="mail" size={18} /></span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </label>
                <div className="fpw-actions">
                  <Link href="/login" className="fpw-btn ghost">ยกเลิก</Link>
                  <button type="submit" className="fpw-btn primary" disabled={loading}>
                    <span>{loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ต'}</span>
                    {!loading && <b>→</b>}
                  </button>
                </div>
              </form>

              <hr className="fpw-divider" />
              <p className="fpw-foot"><Link href="/login">กลับไปเข้าสู่ระบบ</Link></p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
