




(function () {
  function typing(target) {
    return target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  }

  function init() {
    const sheet = document.getElementById('shortcuts');
    if (!sheet || typeof sheet.showModal !== 'function') return;
    let back = null;
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet || event.target.closest('[data-shortcuts-close]')) sheet.close();
    });
    sheet.addEventListener('close', () => {
      if (back && back.isConnected) back.focus({ preventScroll: true });
      back = null;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      if (sheet.open || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      back = document.activeElement;
      sheet.showModal();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
