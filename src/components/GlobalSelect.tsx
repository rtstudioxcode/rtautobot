'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SvgIcon from '@/components/SvgIcon';

const CSS = `
.rt-select-wrap{position:relative;width:100%;font-family:inherit;}
.rt-select-trigger{
  width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;
  border-radius:16px;border:1px solid rgba(124,255,178,.24);
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.016)),rgba(0,0,0,.30);
  color:#eef6ff;padding:0 14px;font-family:inherit;font-size:14px;font-weight:900;line-height:1.2;
  cursor:pointer;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.045);
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease,transform .18s ease;
}
.rt-select-trigger:hover{border-color:rgba(124,255,178,.38);background:linear-gradient(180deg,rgba(8,184,79,.08),rgba(255,255,255,.018)),rgba(0,0,0,.30);}
.rt-select-trigger:focus-visible,.rt-select-wrap.open .rt-select-trigger{border-color:rgba(124,255,178,.64);box-shadow:0 0 0 4px rgba(124,255,178,.11),inset 0 1px 0 rgba(255,255,255,.06);}
.rt-select-trigger:disabled{opacity:.55;cursor:not-allowed;}
.rt-select-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;}
.rt-select-placeholder{color:rgba(238,246,255,.48);}
.rt-select-chev{width:30px;height:30px;flex:0 0 30px;border-radius:12px;display:grid;place-items:center;color:#38e986;background:rgba(8,184,79,.12);border:1px solid rgba(8,184,79,.22);transition:transform .18s ease,background .18s ease;}
.rt-select-wrap.open .rt-select-chev{transform:rotate(180deg);background:rgba(8,184,79,.20);}
.rt-select-menu{
  position:fixed;z-index:2147483200;overflow:hidden;border-radius:18px;border:1px solid rgba(124,255,178,.30);
  background:radial-gradient(circle at 16% 0%,rgba(8,184,79,.18),transparent 34%),linear-gradient(145deg,rgba(24,26,32,.985),rgba(10,12,16,.985));
  box-shadow:0 26px 70px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  animation:rtSelectIn .16s cubic-bezier(.2,.8,.2,1) both;
}
.rt-select-list{max-height:min(330px,calc(100dvh - 40px));overflow:auto;padding:7px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(8,184,79,.55) rgba(255,255,255,.05);}
.rt-select-option{
  width:100%;min-height:42px;border:0;border-radius:13px;background:transparent;color:rgba(238,246,255,.76);font-family:inherit;font-size:14px;font-weight:850;
  display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;cursor:pointer;text-align:left;transition:background .16s ease,color .16s ease,transform .16s ease;
}
.rt-select-option:hover,.rt-select-option.highlight{background:rgba(8,184,79,.13);color:#eef6ff;}
.rt-select-option.selected{background:linear-gradient(135deg,rgba(8,184,79,.92),rgba(5,184,79,.92));color:#06120b;box-shadow:0 10px 24px rgba(8,184,79,.20);}
.rt-select-option:disabled{opacity:.45;cursor:not-allowed;}
.rt-select-option-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rt-select-check{font-weight:1000;color:inherit;opacity:.9;}
.rt-select-empty{padding:14px;color:rgba(238,246,255,.52);font-size:13px;font-weight:800;text-align:center;}
.rt-combo-wrap{position:relative;width:100%;font-family:inherit;}
.rt-combo-input{
  width:100%;min-height:52px;border-radius:16px;border:1px solid rgba(124,255,178,.24);
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.016)),rgba(0,0,0,.30);
  color:#eef6ff;padding:0 46px 0 14px;font-weight:900;outline:none;font-family:inherit;font-size:14px;
  transition:border-color .18s ease,box-shadow .18s ease,background .18s ease;
}
.rt-combo-input:focus{border-color:rgba(124,255,178,.64);box-shadow:0 0 0 4px rgba(124,255,178,.11);}
.rt-combo-icon{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:12px;display:grid;place-items:center;color:#38e986;background:rgba(8,184,79,.12);border:1px solid rgba(8,184,79,.22);pointer-events:none;}
.rt-combo-option-sub{display:block;margin-top:3px;font-size:11px;color:rgba(238,246,255,.46);font-weight:750;}
.rt-select-option.selected .rt-combo-option-sub{color:rgba(6,18,11,.70);}
@keyframes rtSelectIn{from{opacity:0;transform:translateY(-6px) scale(.985);filter:blur(4px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
@media (max-width:640px){
  .rt-select-menu{border-radius:16px;}
  .rt-select-list{max-height:min(300px,calc(100dvh - 34px));}
  .rt-select-trigger,.rt-combo-input{font-size:13px;}
}
`;

function ensureStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('rt-global-select-style')) return;
  const style = document.createElement('style');
  style.id = 'rt-global-select-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function normalizeOptions(options = []) {
  return options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') return { value: opt, label: String(opt) };
    return { ...opt, label: opt.label ?? String(opt.value ?? '') };
  });
}

function useFloatingPosition(anchorRef, open, minWidth = 220) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, minWidth);
      const margin = 10;
      const left = Math.min(Math.max(margin, r.left), window.innerWidth - width - margin);
      const below = r.bottom + 8;
      const estimated = 330;
      const enoughBelow = below + estimated <= window.innerHeight - margin;
      const top = enoughBelow ? below : Math.max(margin, r.top - Math.min(estimated, window.innerHeight - margin * 2) - 8);
      setPos({ left, top, width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, open, minWidth]);

  return pos;
}

export default function GlobalSelect({
  value,
  options = [],
  onChange,
  placeholder = 'เลือกข้อมูล',
  disabled = false,
  className = '',
  ariaLabel,
  name,
}) {
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const opts = useMemo(() => normalizeOptions(options), [options]);
  const selected = opts.find((o) => String(o.value) === String(value));
  const pos = useFloatingPosition(btnRef, open);

  useEffect(() => { ensureStyle(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const selectedIndex = Math.max(0, opts.findIndex((o) => String(o.value) === String(value)));
    setActiveIndex(selectedIndex);
    const onDoc = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, opts, value]);

  const selectOption = (opt) => {
    if (!opt || opt.disabled) return;
    onChange?.(opt.value, opt);
    setOpen(false);
    btnRef.current?.focus?.();
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(opts.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(opts[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className={`rt-select-wrap${open ? ' open' : ''}${className ? ' ' + className : ''}`}>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      <button
        ref={btnRef}
        type="button"
        className="rt-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={`rt-select-value${selected ? '' : ' rt-select-placeholder'}`}>{selected?.label || placeholder}</span>
        <span className="rt-select-chev" aria-hidden="true">⌄</span>
      </button>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className="rt-select-menu" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <div className="rt-select-list" role="listbox">
            {opts.length ? opts.map((opt, index) => (
              <button
                key={`${String(opt.value)}-${index}`}
                type="button"
                disabled={opt.disabled}
                role="option"
                aria-selected={String(opt.value) === String(value)}
                className={`rt-select-option${String(opt.value) === String(value) ? ' selected' : ''}${index === activeIndex ? ' highlight' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(opt)}
              >
                <span className="rt-select-option-label">{opt.label}</span>
                {String(opt.value) === String(value) ? <span className="rt-select-check"><SvgIcon name="check" size={14} /></span> : null}
              </button>
            )) : <div className="rt-select-empty">ไม่มีตัวเลือก</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function GlobalComboBox({
  value,
  onInputChange,
  onSelect,
  options = [],
  placeholder = 'พิมพ์เพื่อค้นหา',
  className = '',
  ariaLabel,
  required = false,
  inputRef,
}) {
  const rootRef = useRef(null);
  const localInputRef = useRef(null);
  const actualInputRef = inputRef || localInputRef;
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const opts = useMemo(() => normalizeOptions(options), [options]);
  const pos = useFloatingPosition(actualInputRef, open);

  useEffect(() => { ensureStyle(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = (opt) => {
    if (!opt || opt.disabled) return;
    onSelect?.(opt.value, opt);
    setOpen(false);
    actualInputRef.current?.focus?.();
  };

  const onKeyDown = (event) => {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(opts.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Enter' && opts[activeIndex]) {
      event.preventDefault();
      select(opts[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className={`rt-combo-wrap${className ? ' ' + className : ''}`}>
      <input
        ref={actualInputRef}
        className="rt-combo-input"
        value={value}
        onChange={(e) => { onInputChange?.(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
      />
      <span className="rt-combo-icon" aria-hidden="true">⌕</span>
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef} className="rt-select-menu" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          <div className="rt-select-list" role="listbox">
            {opts.length ? opts.map((opt, index) => (
              <button
                key={`${String(opt.value)}-${index}`}
                type="button"
                disabled={opt.disabled}
                role="option"
                className={`rt-select-option${index === activeIndex ? ' highlight' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(opt)}
              >
                <span className="rt-select-option-label">
                  {opt.label}
                  {opt.subLabel ? <span className="rt-combo-option-sub">{opt.subLabel}</span> : null}
                </span>
              </button>
            )) : <div className="rt-select-empty">ไม่พบรายการ</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
