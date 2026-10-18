












const ABOUT_SEEN_KEY = 'citator-about-seen';

document.addEventListener('alpine:init', () => {
  Alpine.data('aboutHint', () => ({
    open: false,

    get hintLinkClass() {
      return this.open ? 'about-hint__link--active' : '';
    },

    dismiss() {
      this.open = false;
      try {
        localStorage.setItem(ABOUT_SEEN_KEY, '1');
      } catch (e) {

      }
    },

    init() {
      if (window.location.pathname === '/about/') {
        this.dismiss();
        return;
      }
      let seen = '1';
      try {
        seen = localStorage.getItem(ABOUT_SEEN_KEY);
      } catch (e) {
        seen = '1';
      }
      this.open = !seen;
    },
  }));
});
