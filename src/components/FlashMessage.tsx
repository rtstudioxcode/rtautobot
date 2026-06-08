'use client';

import { useEffect, useState } from 'react';
import SvgIcon from '@/components/SvgIcon';

const CSS = `
.flash-msg {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 14px;
  animation: flashIn .28s ease both;
}
@keyframes flashIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}
.flash-msg.error {
  background: rgba(255,95,115,.10);
  border-color: rgba(255,95,115,.30);
  color: #ffb6bf;
}
.flash-msg.success {
  background: rgba(8,184,79,.10);
  border-color: rgba(8,184,79,.28);
  color: #38e986;
}
.flash-msg.info {
  background: rgba(56,167,255,.10);
  border-color: rgba(56,167,255,.28);
  color: #9dd4ff;
}
.flash-msg-body { flex: 1; min-width: 0; line-height: 1.5; }
.flash-msg-close {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  opacity: .55;
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 14px;
  transition: opacity .15s ease;
}
.flash-msg-close:hover { opacity: 1; }
`;

export default function FlashMessage({ flash }) {
  const [visible, setVisible] = useState(!!flash);

  useEffect(() => {
    if (!flash) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  if (!visible || !flash) return null;

  const isError = flash.type === 'error' || flash.type === 'danger';
  const isSuccess = flash.type === 'success';
  const typeClass = isError ? 'error' : isSuccess ? 'success' : 'info';
  const iconName = isError ? 'error' : isSuccess ? 'check' : 'info';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`flash-msg ${typeClass}`} role="alert">
        <SvgIcon name={iconName} size={18} />
        <p className="flash-msg-body">{flash.message || flash}</p>
        <button className="flash-msg-close" type="button" onClick={() => setVisible(false)} aria-label="ปิดข้อความแจ้งเตือน">
          <SvgIcon name="error" size={15} />
        </button>
      </div>
    </>
  );
}
