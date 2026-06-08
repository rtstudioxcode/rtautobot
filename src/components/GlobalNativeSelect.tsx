'use client';

import { useEffect } from 'react';

const CSS = `
select.rt-native-select-hidden{
  position:absolute!important;width:1px!important;height:1px!important;min-width:1px!important;min-height:1px!important;
  padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;
  border:0!important;opacity:0!important;pointer-events:none!important;
}
.rt-select{
  --rt-select-bg:color-mix(in srgb,var(--card,#1d1d22) 88%,#000 12%);
  --rt-select-border:color-mix(in srgb,var(--accent,#08b84f) 38%,rgba(255,255,255,.1));
  --rt-select-text:var(--text,#eef6ff);
  --rt-select-muted:var(--muted,rgba(238,246,255,.66));
  --rt-select-accent:var(--accent,#08b84f);
  position:relative;width:100%;min-width:0;font-family:inherit;z-index:1;
}
.rt-select.is-open{z-index:20000;}
.rt-select__button{
  width:100%;min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:0 14px 0 16px;border:1px solid var(--rt-select-border);border-radius:16px;
  background:radial-gradient(circle at 18% 0%,color-mix(in srgb,var(--rt-select-accent) 16%,transparent),transparent 34%),linear-gradient(180deg,color-mix(in srgb,#fff 5%,transparent),transparent 42%),var(--rt-select-bg);
  color:var(--rt-select-text);font:inherit;font-weight:850;line-height:1.2;cursor:pointer;text-align:left;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 14px 32px rgba(0,0,0,.22);
  transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease,background .18s ease;
}
.rt-select__button:hover{border-color:color-mix(in srgb,var(--rt-select-accent) 58%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 16px 40px rgba(0,0,0,.28),0 0 0 4px color-mix(in srgb,var(--rt-select-accent) 9%,transparent);}
.rt-select__button:focus-visible{outline:none;border-color:color-mix(in srgb,var(--rt-select-accent) 74%,#fff 6%);box-shadow:0 0 0 4px color-mix(in srgb,var(--rt-select-accent) 18%,transparent),0 16px 42px rgba(0,0,0,.34);}
.rt-select__value{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rt-select__chevron{flex:0 0 auto;width:24px;height:24px;display:grid;place-items:center;border-radius:999px;color:color-mix(in srgb,var(--rt-select-accent) 78%,#fff 22%);background:color-mix(in srgb,var(--rt-select-accent) 13%,transparent);transition:transform .18s ease,background .18s ease;}
.rt-select.is-open .rt-select__chevron{transform:rotate(180deg);background:color-mix(in srgb,var(--rt-select-accent) 22%,transparent);}
.rt-select__menu{
  position:absolute;left:0;right:0;top:calc(100% + 8px);max-height:min(320px,52vh);overflow:auto;padding:8px;
  border:1px solid color-mix(in srgb,var(--rt-select-accent) 32%,rgba(255,255,255,.11));border-radius:18px;
  background:linear-gradient(180deg,rgba(35,35,41,.98),rgba(16,16,20,.98));
  box-shadow:0 26px 70px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.04) inset;
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;visibility:hidden;transform:translateY(-6px) scale(.985);
  transform-origin:top center;transition:opacity .16s ease,transform .16s ease,visibility .16s ease;
}
.rt-select.is-open .rt-select__menu{opacity:1;visibility:visible;transform:translateY(0) scale(1);}
.rt-select__option{
  width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;
  border:0;border-radius:13px;background:transparent;color:var(--rt-select-text);font:inherit;font-weight:750;text-align:left;cursor:pointer;
  transition:background .15s ease,color .15s ease,transform .15s ease;
}
.rt-select__option:hover,.rt-select__option.is-active{background:color-mix(in srgb,var(--rt-select-accent) 18%,transparent);color:#eef6ff;}
.rt-select__option.is-selected{background:linear-gradient(135deg,color-mix(in srgb,var(--rt-select-accent) 78%,#fff 4%),color-mix(in srgb,var(--rt-select-accent) 52%,#008c38 28%));color:#141006;box-shadow:0 10px 24px color-mix(in srgb,var(--rt-select-accent) 20%,transparent);}
.rt-select__option.is-disabled{opacity:.45;cursor:not-allowed;}
.rt-select__check{opacity:0;font-size:13px;font-weight:1000;}
.rt-select__option.is-selected .rt-select__check{opacity:1;}
.rt-select.is-disabled{opacity:.58;pointer-events:none;}
@media (max-width:640px){.rt-select__button{min-height:44px;border-radius:15px;padding-inline:13px;}.rt-select__menu{max-height:min(300px,48vh);border-radius:16px;}}
`;

const SELECTOR = 'select:not([multiple]):not([data-native-select="true"]):not(.rt-native-select-hidden)';

type EnhancedSelect = HTMLSelectElement & { __rtSelectWidget?: HTMLDivElement };
type SelectWidget = HTMLDivElement & { __rtNativeSelect?: EnhancedSelect };

function optionText(option?: HTMLOptionElement | null) {
  return (option?.textContent || option?.label || '').trim();
}

function getSelectedOption(select: HTMLSelectElement) {
  return select.options[select.selectedIndex] || select.options[0] || null;
}

export default function GlobalNativeSelect() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    if (!document.getElementById('rt-global-custom-select-style')) {
      const style = document.createElement('style');
      style.id = 'rt-global-custom-select-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    let openWidget: SelectWidget | null = null;

    const close = (widget?: SelectWidget | null) => {
      if (!widget) return;
      widget.classList.remove('is-open');
      widget.querySelector('.rt-select__button')?.setAttribute('aria-expanded', 'false');
      if (openWidget === widget) openWidget = null;
    };

    const closeAll = (except?: SelectWidget | null) => {
      document.querySelectorAll<SelectWidget>('.rt-select.is-open').forEach((widget) => {
        if (widget !== except) close(widget);
      });
    };

    const sync = (select: EnhancedSelect) => {
      const widget = select.__rtSelectWidget;
      if (!widget || !document.documentElement.contains(select)) {
        widget?.remove();
        return;
      }
      const selected = getSelectedOption(select);
      const value = widget.querySelector<HTMLElement>('.rt-select__value');
      if (value) value.textContent = selected ? optionText(selected) : 'เลือกข้อมูล';
      widget.classList.toggle('is-disabled', select.disabled);
      const menu = widget.querySelector<HTMLElement>('.rt-select__menu');
      if (!menu) return;
      const currentSignature = Array.from(select.options).map((opt, index) => `${index}:${opt.value}:${optionText(opt)}:${opt.disabled}:${index === select.selectedIndex}`).join('|');
      if (menu.dataset.signature === currentSignature) return;
      menu.dataset.signature = currentSignature;
      menu.innerHTML = '';
      Array.from(select.options).forEach((opt, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'rt-select__option';
        item.setAttribute('role', 'option');
        item.dataset.index = String(index);
        const label = document.createElement('span');
        label.textContent = optionText(opt) || ' ';
        const check = document.createElement('span');
        check.className = 'rt-select__check';
        check.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17l9-10"/></svg>';
        item.append(label, check);
        if (opt.disabled) {
          item.classList.add('is-disabled');
          item.disabled = true;
        }
        if (index === select.selectedIndex) {
          item.classList.add('is-selected');
          item.setAttribute('aria-selected', 'true');
        }
        item.addEventListener('click', () => {
          if (opt.disabled) return;
          select.selectedIndex = index;
          select.value = opt.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          sync(select);
          close(widget);
        });
        menu.appendChild(item);
      });
    };

    const enhance = (select: EnhancedSelect) => {
      if (!select || select.__rtSelectWidget || select.multiple || select.dataset.nativeSelect === 'true') return;
      if (select.closest('.rt-select')) return;
      const widget = document.createElement('div') as SelectWidget;
      widget.className = 'rt-select';
      widget.setAttribute('data-rt-select', '');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rt-select__button';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span class="rt-select__value"></span><span class="rt-select__chevron" aria-hidden="true">⌄</span>';
      const menu = document.createElement('div');
      menu.className = 'rt-select__menu';
      menu.setAttribute('role', 'listbox');
      select.parentNode?.insertBefore(widget, select.nextSibling);
      widget.append(btn, menu);
      select.classList.add('rt-native-select-hidden');
      select.__rtSelectWidget = widget;
      widget.__rtNativeSelect = select;

      btn.addEventListener('click', (event) => {
        event.preventDefault();
        if (select.disabled) return;
        const willOpen = !widget.classList.contains('is-open');
        closeAll(widget);
        widget.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        openWidget = willOpen ? widget : null;
        if (willOpen) widget.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
      });

      select.addEventListener('change', () => sync(select));
      select.addEventListener('input', () => sync(select));
      select.addEventListener('rt-select:refresh', () => sync(select));
      new MutationObserver(() => sync(select)).observe(select, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'label', 'value', 'selected'],
      });
      sync(select);
    };

    const enhanceAll = (root: ParentNode = document) => {
      root.querySelectorAll<EnhancedSelect>(SELECTOR).forEach(enhance);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (openWidget && !target?.closest('.rt-select')) close(openWidget);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(SELECTOR)) enhance(node as EnhancedSelect);
          node.querySelectorAll?.<EnhancedSelect>(SELECTOR).forEach(enhance);
        });
        mutation.removedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          node.querySelectorAll?.<EnhancedSelect>('select.rt-native-select-hidden').forEach((select) => {
            select.__rtSelectWidget?.remove();
          });
        });
      }
    });

    const refreshAll = () => document.querySelectorAll<EnhancedSelect>('select.rt-native-select-hidden').forEach(sync);

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    enhanceAll();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const interval = window.setInterval(refreshAll, 500);
    (window as any).RTCustomSelect = { enhanceAll, refresh: (select?: EnhancedSelect) => (select ? sync(select) : refreshAll()) };

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}
