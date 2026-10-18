




document.addEventListener('alpine:init', () => {
  Alpine.data('helpMenu', () => ({
    helpOpen: false,

    get helpExpanded() {
      return this.helpOpen ? 'true' : 'false';
    },
    get helpClass() {
      return this.helpOpen ? 'is-open' : '';
    },

    helpItems() {
      return Array.from(this.$root.querySelectorAll('[role="menuitem"]'));
    },
    focusItem(index) {
      const items = this.helpItems();
      if (!items.length) return;
      items[(index + items.length) % items.length].focus();
    },

    openHelp(fromEnd = false) {
      this.helpOpen = true;
      if (typeof this.dismiss === 'function') this.dismiss();
      this.$nextTick(() => this.focusItem(fromEnd ? -1 : 0));
    },
    closeHelp(returnFocus = true) {
      if (!this.helpOpen) return;
      this.helpOpen = false;
      if (returnFocus) this.$refs.helpButton.focus();
    },
    toggleHelp() {
      if (this.helpOpen) this.closeHelp();
      else this.openHelp();
    },
    helpClickOutside() {
      this.closeHelp(false);
    },

    onHelpKeydown(event) {
      const onButton = event.target === this.$refs.helpButton;
      if (!this.helpOpen) {
        if (onButton && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          this.openHelp(event.key === 'ArrowUp');
        }
        return;
      }
      const items = this.helpItems();
      const at = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeHelp();
      } else if (event.key === 'Tab') {
        this.closeHelp(false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.focusItem(at + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.focusItem(at < 0 ? -1 : at - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.focusItem(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        this.focusItem(-1);
      }
    },

    openShortcuts() {
      const dialog = document.getElementById('shortcuts');
      this.closeHelp(false);
      if (!dialog || dialog.open || typeof dialog.showModal !== 'function') return;

      this.$refs.helpButton.focus({ preventScroll: true });
      dialog.showModal();
    },
  }));
});
