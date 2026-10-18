














document.addEventListener('alpine:init', () => {
  Alpine.data('listToggle', () => ({
    toggle(event) {
      const button = event.currentTarget;
      const cell = button.closest('[data-cite-cell]');
      if (!cell) return;
      const expanded = cell.classList.toggle('is-expanded');
      button.textContent = expanded ? button.dataset.less : button.dataset.more;
      const noun = button.dataset.noun || 'citation';
      const count = parseInt(button.dataset.more, 10) || 0;
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', expanded ? `Collapse ${noun}s` : `Show ${count} more ${noun}${count === 1 ? '' : 's'}`);
      if (!expanded) cell.dispatchEvent(new CustomEvent('cite-list:collapse', { bubbles: true }));
    },
  }));
});
