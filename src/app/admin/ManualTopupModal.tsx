'use client';

import { useState, useEffect, useRef } from 'react';

const METHODS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manual', label: 'เติมมือ' },
  { value: 'tw', label: 'TrueMoney Wallet' },
  { value: 'qr', label: 'PromptPay QR' },
  { value: 'kbank', label: 'กสิกรไทย' },
  { value: 'scb', label: 'ไทยพาณิชย์' },
];

const CSS = `
.rt-mtu-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px}
.rt-mtu-bg{position:absolute;inset:0;background:rgba(0,0,0,.74);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.rt-mtu-dialog{position:relative;width:min(560px,100%);border:1px solid rgba(124,255,178,.28);border-radius:30px;background:radial-gradient(520px 220px at 100% 0,rgba(124,255,178,.13),transparent 58%),linear-gradient(135deg,rgba(28,28,32,.98),rgba(14,14,18,.98));box-shadow:0 34px 96px rgba(0,0,0,.58);padding:24px;color:#eef6ff}
.rt-mtu-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
.rt-mtu-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;border:1px solid rgba(124,255,178,.28);background:rgba(124,255,178,.12);color:#08b84f;font-weight:1000;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
.rt-mtu-head h2{margin:9px 0 0;font-size:28px;font-weight:800;color:#eef6ff}
.rt-mtu-close{width:44px;height:44px;border-radius:15px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.06);color:#eef6ff;font-size:26px;line-height:1;cursor:pointer}
.rt-mtu-form{display:grid;gap:14px}
.rt-mtu-form label span{display:block;margin-bottom:8px;color:#08b84f;font-weight:1000}
.rt-mtu-input{width:100%;min-height:52px;border-radius:16px;border:1px solid rgba(124,255,178,.24);background:rgba(0,0,0,.3);color:#eef6ff;padding:0 14px;font-weight:900;outline:none;font-family:inherit;font-size:14px}
.rt-mtu-input:focus{border-color:rgba(124,255,178,.64);box-shadow:0 0 0 4px rgba(124,255,178,.11)}
.rt-mtu-input[readonly]{opacity:.72}
.rt-mtu-note,.rt-mtu-status{border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.045);padding:13px 15px;color:#08b84f;font-weight:760}
.rt-mtu-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:4px}
.rt-mtu-btn{border:0;border-radius:14px;padding:11px 13px;font-weight:1000;cursor:pointer;color:#16120b;background:linear-gradient(135deg,#21b95c,#05b84f);font-family:inherit;font-size:13px}
.rt-mtu-btn.success{background:linear-gradient(135deg,#8dffc0,#23ba6a)}
`;

export default function ManualTopupModal({ open, onClose, prefill }) {
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('admin');
  const [txId, setTxId] = useState('');
  const [amountLocked, setAmountLocked] = useState(false);
  const [status, setStatus] = useState('');
  const [users, setUsers] = useState([]);
  const usernameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const p = prefill || {};
    setTxId(p.txId || '');
    setUsername(p.username || '');
    const amt = Number(p.amount || 0);
    setAmount(amt > 0 ? amt.toFixed(2) : '');
    setAmountLocked(amt > 0);
    const m = p.method ? (p.method === 'truewallet' ? 'tw' : p.method.toLowerCase()) : 'admin';
    setMethod(METHODS.some(o => o.value === m) ? m : 'admin');
    setStatus('');
    searchUsers(p.username || '');
    setTimeout(() => usernameRef.current?.focus(), 50);
  }, [open, prefill]);

  async function searchUsers(q) {
    try {
      const url = q?.length
        ? `/api/admin/users?q=${encodeURIComponent(q)}&perPage=20`
        : `/api/admin/users?perPage=20`;
      const r = await fetch(url);
      const j = await r.json();
      if (j?.ok) setUsers(j.users || []);
    } catch {}
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = Number(amount || 0);
    if (!username || !(amt > 0)) { setStatus('❌ กรุณากรอกชื่อผู้ใช้และจำนวนเงินให้ครบถ้วน'); return; }
    setStatus('⏳ กำลังทำรายการ...');
    try {
      const r = await fetch('/api/admin/manual-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, amount: amt, method, txId: txId || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || 'เติมเงินไม่สำเร็จ');
      setStatus(`✅ เติมเงินสำเร็จให้ ${username} จำนวน ${amt.toLocaleString()} บาท`);
      setTimeout(() => { onClose(); location.reload(); }, 900);
    } catch (err: any) {
      setStatus('❌ ' + (err?.message || 'ทำรายการไม่สำเร็จ'));
    }
  }

  if (!open) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rt-mtu-overlay">
        <div className="rt-mtu-bg" onClick={onClose} />
        <div className="rt-mtu-dialog">
          <div className="rt-mtu-head">
            <div>
              <span className="rt-mtu-eyebrow">Manual Topup</span>
              <h2>เติมเงินให้ผู้ใช้</h2>
            </div>
            <button onClick={onClose} className="rt-mtu-close">×</button>
          </div>

          <form onSubmit={handleSubmit} className="rt-mtu-form">
            <input type="hidden" value={txId} />
            <label>
              <span>ชื่อผู้ใช้</span>
              <input
                ref={usernameRef}
                className="rt-mtu-input"
                list="manualUserList"
                value={username}
                onChange={e => { setUsername(e.target.value); searchUsers(e.target.value.trim()); }}
                autoComplete="off"
                required
                placeholder="พิมพ์ Username หรือเลือกจากรายการ"
              />
              <datalist id="manualUserList">
                {users.map(u => <option key={u.username} value={u.username} label={`${u.username}${u.email ? ' · ' + u.email : ''}`} />)}
              </datalist>
            </label>

            <label>
              <span>จำนวนเงิน</span>
              <input
                className="rt-mtu-input"
                type="number" step="0.01" min="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                readOnly={amountLocked}
                required placeholder="เช่น 100"
                style={amountLocked ? { opacity: .72 } : undefined}
              />
            </label>

            <label>
              <span>Method การเติมเงิน</span>
              <select
                className="rt-mtu-input"
                value={method}
                onChange={e => setMethod(e.target.value)}
                required
              >
                {METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <div className="rt-mtu-note">
              ระบบจะเพิ่มเครดิตเข้ากระเป๋าผู้ใช้ทันที และบันทึกประวัติเป็นรายการของ RTAUTOBOT
            </div>

            {status && <div className="rt-mtu-status">{status}</div>}

            <div className="rt-mtu-actions">
              <button type="button" onClick={onClose} className="rt-mtu-btn">ยกเลิก</button>
              <button type="submit" className="rt-mtu-btn success">ยืนยันเติมเงิน</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
