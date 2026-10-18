










document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  event.preventDefault();

  const hash = link.getAttribute('href').slice(1);
  const base = window.location.pathname + window.location.search;
  history.replaceState(null, '', hash ? `${base}#${hash}` : base);
  window.dispatchEvent(new HashChangeEvent('hashchange'));



  requestAnimationFrame(() => {
    let target = hash && hash !== 'top' ? document.getElementById(hash) : null;
    const panel = !target && hash ? document.getElementById(`panel-${hash}`) : null;
    if (panel) target = document.getElementById(panel.getAttribute('aria-labelledby') || '');
    if (!target) {
      window.scrollTo({ top: 0 });
      return;
    }
    target.scrollIntoView({ block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});
