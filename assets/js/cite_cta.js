







(function () {
  const timers = new WeakMap();
  const active = new Map();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function spanOf(el) {
    const raw = getComputedStyle(el).getPropertyValue('--cta-span').trim();
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return 0;
    return /ms$/.test(raw) ? n : n * 1000;
  }

  function release(el, immediate = false) {
    clearTimeout(timers.get(el));
    if (immediate || motion.matches) {
      el.removeAttribute('data-held');
      return;
    }
    timers.set(
      el,
      setTimeout(() => el.removeAttribute('data-held'), spanOf(el))
    );
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      const el = event.target.closest && event.target.closest('[data-cite-cta]');
      if (!el) return;
      clearTimeout(timers.get(el));
      active.set(event.pointerId, el);
      el.setAttribute('data-held', '');
    },
    { passive: true }
  );
  function finish(event) {
    const el = active.get(event.pointerId);
    if (!el) return;
    active.delete(event.pointerId);
    release(el, event.type === 'pointercancel');
  }
  function reset() {
    active.clear();
    document.querySelectorAll('[data-cite-cta][data-held]').forEach((el) => release(el, true));
  }
  document.addEventListener('pointerup', finish, { passive: true, capture: true });
  document.addEventListener('pointercancel', finish, { passive: true, capture: true });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
  });
  motion.addEventListener('change', reset);
})();
