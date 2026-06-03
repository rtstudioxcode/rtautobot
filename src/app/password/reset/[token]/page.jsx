'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const CSS = `
.rpw-page {
  min-height: 100vh; display: grid; place-items: center;
  padding: clamp(20px,4vw,52px); isolation: isolate; color: #eef6ff;
  background:
    radial-gradient(circle at 15% 28%,rgba(8,184,79,.28),transparent 30%),
    radial-gradient(circle at 88% 72%,rgba(61,137,255,.18),transparent 32%),
    linear-gradient(135deg,rgba(7,8,11,.94),#07080c);
}
.rpw-card {
  position: relative; width: min(520px,100%); overflow: hidden; border-radius: 30px;
  border: 1px solid rgba(124,255,178,.22);
  background: linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.02)),#111218;
  box-shadow: 0 40px 100px rgba(0,0,0,.56), inset 0 1px 0 rgba(255,255,255,.07);
  padding: 32px; animation: rpwIn .5s cubic-bezier(.2,.9,.2,1) both;
}
.rpw-card::before {
  content: ""; position: absolute; inset: 0 0 auto; height: 3px;
  background: linear-gradient(90deg, transparent, #08b84f, transparent); opacity: .85;
}
.rpw-head { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; }
.rpw-badge {
  width: 58px; height: 58px; flex: 0 0 58px; border-radius: 20px;
  display: grid; place-items: center;
  background: linear-gradient(135deg,#08b84f,#05b84f);
  box-shadow: 0 16px 36px rgba(8,184,79,.26); font-size: 26px; color: #17130a;
}
.rpw-kicker { color: #08b84f; font-size: 11px; font-weight: 950; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 4px; }
.rpw-heading { display: block; font-size: 26px; font-weight: 1000; color: #eef6ff; letter-spacing: -.04em; }
.rpw-copy { display: block; color: #08b84f; font-size: 13px; font-weight: 750; margin-top: 4px; line-height: 1.6; }
.rpw-form { display: grid; gap: 14px; }
.rpw-field { display: grid; gap: 8px; }
.rpw-label { font-size: 13px; font-weight: 900; color: rgba(8,184,79,.9); }
.rpw-inputbox {
  position: relative; min-height: 54px; border: 1px solid rgba(255,255,255,.10); border-radius: 16px;
  background: rgba(7,8,11,.7); display: grid; grid-template-columns: 50px minmax(0,1fr); align-items: center;
  overflow: hidden; transition: border-color .18s ease, box-shadow .18s ease;
}
.rpw-inputbox:focus-within { border-color: rgba(8,184,79,.6); box-shadow: 0 0 0 3px rgba(8,184,79,.12); }
.rpw-icon { height: 54px; display: grid; place-items: center; background: rgba(0,0,0,.2); color: #08b84f; font-size: 16px; }
.rpw-inputbox input {
  width: 100%; height: 54px; border: 0; outline: 0; background: transparent;
  color: #eef6ff; font: inherit; font-weight: 750; padding: 0 14px; font-size: 14px;
}
.rpw-inputbox input::placeholder { color: rgba(255,255,255,.28); }
.rpw-msg { padding: 12px 14px; border-radius: 14px; font-size: 13px; font-weight: 750; }
.rpw-msg.ok { background: rgba(8,184,79,.12); border: 1px solid rgba(8,184,79,.28); color: #38e986; }
.rpw-msg.err { background: rgba(255,95,115,.12); border: 1px solid rgba(255,95,115,.28); color: #ffb6bf; }
.rpw-btn {
  height: 54px; border: 0; border-radius: 16px; font-size: 15px; font-weight: 900; font-family: inherit;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
  background: linear-gradient(135deg,#08b84f,#05b84f); color: #17130a;
  box-shadow: 0 18px 40px rgba(8,184,79,.24), inset 0 1px 0 rgba(255,255,255,.55);
  transition: transform .2s ease, filter .2s ease;
}
.rpw-btn:hover { transform: translateY(-2px); filter: saturate(1.05); }
.rpw-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
.rpw-foot { text-align: center; margin-top: 16px; font-size: 13px; color: rgba(238,246,255,.5); }
.rpw-foot a { color: #08b84f; text-decoration: none; font-weight: 800; }
.rpw-foot a:hover { text-decoration: underline; }
@keyframes rpwIn { from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)} }
`;

export default function ResetPasswordPage() {
  const { token } = useParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setMsg({ ok: false, text: 'รหัสผ่านไม่ตรงกัน' }); return; }
    if (password.length < 8) { setMsg({ ok: false, text: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }); return; }
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (d.ok) {
        setMsg({ ok: true, text: 'เปลี่ยนรหัสผ่านสำเร็จ กำลังเข้าสู่ระบบ...' });
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setMsg({ ok: false, text: d.message || 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว' });
      }
    } catch {
      setMsg({ ok: false, text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rpw-page">
        <div className="rpw-card">
          <div className="rpw-head">
            <span className="rpw-badge">🔑</span>
            <div>
              <span className="rpw-kicker">PASSWORD RESET</span>
              <span className="rpw-heading">ตั้งรหัสผ่านใหม่</span>
              <span className="rpw-copy">กรอกรหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span>
            </div>
          </div>

          {msg && <div className={`rpw-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginBottom: 14 }}>{msg.text}</div>}

          <form className="rpw-form" onSubmit={handleSubmit}>
            <label className="rpw-field">
              <span className="rpw-label">รหัสผ่านใหม่</span>
              <div className="rpw-inputbox">
                <span className="rpw-icon">••</span>
                <input
                  type="password"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </label>
            <label className="rpw-field">
              <span className="rpw-label">ยืนยันรหัสผ่านใหม่</span>
              <div className="rpw-inputbox">
                <span className="rpw-icon">••</span>
                <input
                  type="password"
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
            </label>
            <button type="submit" className="rpw-btn" disabled={loading}>
              <span>{loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}</span>
              {!loading && <b>→</b>}
            </button>
          </form>

          <p className="rpw-foot"><Link href="/login">กลับไปเข้าสู่ระบบ</Link></p>
        </div>
      </div>
    </>
  );
}
