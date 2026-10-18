







const HIGHLIGHT_MS = 3000;

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

function highlightElement(el, className, { block = 'center' } = {}) {
  if (!el) return;
  el.scrollIntoView({ behavior: scrollBehavior(), block });
  el.classList.remove(className);
  void el.offsetHeight;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), HIGHLIGHT_MS);
}
