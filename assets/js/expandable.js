










(function () {
  const MORE = 'Show more';
  const LESS = 'Show less';

  function setUp(root) {
    const body = root.querySelector('.expand__body');
    const inner = body && body.querySelector('.expand__inner');
    const button = root.querySelector('button[aria-controls]');
    if (!body || !inner || !button) return;
    const lines = parseInt(root.dataset.lines || '3', 10);
    let open = false;
    let sizes = null;
    let target = null;
    let frame = 0;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function apply(animate = true) {
      if (!sizes) return;
      const overflows = sizes.full > sizes.collapsed + 1;
      const next = overflows && !open ? sizes.collapsed : sizes.full;
      const current = body.getBoundingClientRect().height;
      const distance = Math.abs(next - current);
      const span = Math.max(1, sizes.full - sizes.collapsed);
      const base = parseFloat(getComputedStyle(body).getPropertyValue('--expand-base')) || 200;
      const duration = animate && target !== null && !motion.matches
        ? Math.min(base, Math.max(80, base * distance / span))
        : 0;
      button.hidden = !overflows;
      body.classList.add('is-measured');
      body.classList.toggle('is-clamped', overflows && !open);
      if (next !== target || !animate) {
        body.style.setProperty('--expand-duration', `${duration}ms`);
        body.style.height = `${next}px`;
        target = next;
      }
    }

    function measure() {
      const style = getComputedStyle(body);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      const full = inner.scrollHeight;
      if (!full) return;
      sizes = { collapsed: Math.round(lineHeight * lines), full };
      apply();
    }

    function scheduleMeasure() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    }

    button.addEventListener('click', () => {
      open = !open;
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? LESS : MORE;
      apply();
    });

    if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(inner);
    motion.addEventListener('change', () => apply(false));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);
    measure();
  }

  function init() {
    document.querySelectorAll('[data-expand]').forEach(setUp);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
