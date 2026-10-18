













const HIDDEN = 'cite-fit-hidden';

function fitList(list) {
  const cell = list.closest('dd[data-cite-cell]');
  if (!cell || cell.classList.contains('is-expanded')) return;
  const items = Array.from(list.querySelectorAll('.cite-item'));
  const candidates = items.filter((i) => !i.classList.contains('cite-extra'));
  if (!candidates.length) return;
  const button = list.nextElementSibling;
  const hasButton = button && button.classList.contains('cite-list__more');


  candidates.forEach((i) => i.classList.remove(HIDDEN));
  if (hasButton) button.hidden = false;
  const box = cell.getBoundingClientRect();
  if (box.width === 0) return;
  const lineTop = candidates[0].getBoundingClientRect().top;
  const fits = (el) => {
    const r = el.getBoundingClientRect();
    return r.right <= box.right + 0.5 && r.top <= lineTop + 1;
  };

  let visible = candidates.length;
  while (visible > 1 && !(fits(candidates[visible - 1]) && (!hasButton || fits(button)))) {
    visible -= 1;
    candidates[visible].classList.add(HIDDEN);
  }
  if (!hasButton) return;
  const hidden = items.length - visible;
  const noun = button.dataset.noun || 'citation';
  button.dataset.more = `+${hidden}`;
  button.textContent = `+${hidden}`;
  button.setAttribute('aria-label', `Show ${hidden} more ${noun}${hidden === 1 ? '' : 's'}`);
  button.hidden = hidden === 0;
}

function fitAll() {
  document.querySelectorAll('[data-cite-fit]').forEach(fitList);
}

document.addEventListener('DOMContentLoaded', () => {
  fitAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver((entries) => {
      for (const e of entries) e.target.querySelectorAll('[data-cite-fit]').forEach(fitList);
    });
    const cells = new Set();
    document.querySelectorAll('[data-cite-fit]').forEach((list) => {
      const cell = list.closest('dd[data-cite-cell]');
      if (cell) cells.add(cell);
    });
    cells.forEach((cell) => observer.observe(cell));
  } else {
    window.addEventListener('resize', fitAll);
  }


  document.addEventListener('cite-list:collapse', (e) => {
    e.target.querySelectorAll('[data-cite-fit]').forEach(fitList);
  });
});
