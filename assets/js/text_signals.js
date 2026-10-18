





(function () {
  const KEY = 'citator-text-signals';

  function init() {
    const switches = Array.from(document.querySelectorAll('[data-text-signals]'));
    if (!switches.length) return;
    const root = document.documentElement;
    const paint = () => {
      const on = !root.classList.contains('text-signals-off');
      switches.forEach((el) => el.setAttribute('aria-checked', String(on)));
    };
    switches.forEach((el) =>
      el.addEventListener('click', () => {
        const off = !root.classList.contains('text-signals-off');
        root.classList.toggle('text-signals-off', off);
        try {
          localStorage.setItem(KEY, off ? 'off' : 'on');
        } catch (e) {

        }
        paint();
      })
    );
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
