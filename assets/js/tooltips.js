






(() => {
  let active = null;
  let frame = 0;
  let nextId = 0;
  const records = new WeakMap();

  function prepare(anchor) {
    if (records.has(anchor)) return records.get(anchor);
    let tip = anchor.querySelector('.pill-tip, .tooltip-bubble');
    if (!tip && anchor.hasAttribute('data-tooltip')) {
      tip = document.createElement('span');
      tip.className = 'tooltip-bubble';
      tip.textContent = anchor.getAttribute('data-tooltip');
      anchor.append(tip);
    }
    if (!tip) return null;
    tip.id = tip.id || `tooltip-${++nextId}`;
    tip.setAttribute('role', 'tooltip');
    const described = new Set((anchor.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    described.add(tip.id);
    anchor.setAttribute('aria-describedby', [...described].join(' '));
    anchor.classList.add('has-positioned-tooltip');
    const native = typeof tip.showPopover === 'function';
    if (native) tip.setAttribute('popover', 'manual');
    tip.classList.add('is-positioned');
    const record = { anchor, tip, native, parent: tip.parentNode, next: tip.nextSibling };
    records.set(anchor, record);
    return record;
  }

  function close() {
    if (!active) return;
    const { tip, native, parent, next } = active;
    tip.classList.remove('is-open');
    if (native && tip.matches(':popover-open')) tip.hidePopover();
    if (!native && parent.isConnected) parent.insertBefore(tip, next && next.parentNode === parent ? next : null);
    active = null;
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function place() {
    frame = 0;
    if (!active) return;
    const { anchor, tip } = active;
    const rect = anchor.getBoundingClientRect();
    if (!anchor.isConnected || rect.bottom < 0 || rect.top > window.innerHeight) {
      close();
      return;
    }
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const preferred = below + height <= window.innerHeight - 8 ? below : rect.top - height - 8;
    const y = Math.max(8, Math.min(preferred, window.innerHeight - height - 8));
    tip.style.setProperty('--tooltip-x', `${Math.round(x)}px`);
    tip.style.setProperty('--tooltip-y', `${Math.round(y)}px`);
  }

  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(place);
  }

  function open(anchor) {
    if (active && active.anchor === anchor) return;
    close();
    active = prepare(anchor);
    if (!active) return;
    if (!active.native) document.body.append(active.tip);
    active.tip.classList.add('is-open');
    if (active.native) active.tip.showPopover();
    place();
  }

  function target(event) {
    return event.target.closest && event.target.closest('.severity-badge--defined, .tooltip-target[data-tooltip]');
  }

  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const anchor = target(event);
    if (anchor) open(anchor);
  });
  document.addEventListener('pointerout', event => {
    if (!active || active.anchor.contains(event.relatedTarget)) return;
    if (active.anchor.contains(event.target) && !active.anchor.contains(document.activeElement)) close();
  });
  document.addEventListener('focusin', event => {
    const anchor = target(event);
    if (anchor) open(anchor);
    else close();
  });
  document.addEventListener('focusout', event => {
    if (active && active.anchor.contains(event.target) && !active.anchor.contains(event.relatedTarget)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  document.addEventListener('pointerdown', event => {
    if (active && !active.anchor.contains(event.target)) close();
  }, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('blur', close);
  function init() {
    document.querySelectorAll('.severity-badge--defined, .tooltip-target[data-tooltip]').forEach(prepare);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
