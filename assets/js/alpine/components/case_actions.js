






function caseActionsCopy(text, done) {
  const report = (ok) => {
    if (!window.citatorToast) return;
    if (ok) window.citatorToast({ title: done, intent: 'positive' });
    else window.citatorToast({ title: 'Copy failed', message: 'Select the text and copy it instead.', intent: 'destructive' });
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(
      () => report(true),
      () => report(false)
    );
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  area.remove();
  report(ok);
}

document.addEventListener('alpine:init', () => {
  Alpine.data('caseActions', () => ({
    menuOpen: false,

    get menuExpanded() {
      return this.menuOpen ? 'true' : 'false';
    },
    get menuClass() {
      return this.menuOpen ? 'is-open' : '';
    },

    menuItems() {
      return Array.from(this.$root.querySelectorAll('[role="menuitem"]'));
    },
    focusMenuItem(index) {
      const items = this.menuItems();
      if (items.length) items[(index + items.length) % items.length].focus();
    },
    openMenu(fromEnd = false) {
      this.menuOpen = true;
      this.$nextTick(() => this.focusMenuItem(fromEnd ? -1 : 0));
    },
    closeMenu(returnFocus = true) {
      if (!this.menuOpen) return;
      this.menuOpen = false;
      if (returnFocus) this.$refs.menuButton.focus();
    },
    toggleMenu() {
      if (this.menuOpen) this.closeMenu();
      else this.openMenu();
    },
    menuClickOutside() {
      this.closeMenu(false);
    },
    onMenuKeydown(event) {
      const onButton = event.target === this.$refs.menuButton;
      if (!this.menuOpen) {
        if (onButton && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          this.openMenu(event.key === 'ArrowUp');
        }
        return;
      }
      const at = this.menuItems().indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeMenu();
      } else if (event.key === 'Tab') {
        this.closeMenu(false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.focusMenuItem(at + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.focusMenuItem(at < 0 ? -1 : at - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.focusMenuItem(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        this.focusMenuItem(-1);
      }
    },

    copyFormat() {
      caseActionsCopy(this.$el.dataset.copy || '', this.$el.dataset.done || 'Copied');
      this.closeMenu();
    },
    copyPageLink() {
      caseActionsCopy(`${window.location.origin}${window.location.pathname}`, 'Link to this opinion copied');
      this.closeMenu();
    },
  }));
});
