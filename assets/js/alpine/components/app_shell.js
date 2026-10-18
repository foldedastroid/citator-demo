const SHELL_WIDE = '(min-width: 1024px)';
const SIDEBAR_KEY = 'citator-sidebar';
const PANEL_KEY = 'citator-panel';

const SWIPE_CLOSE_PX = 64;
let swipe = null;

function shellStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function shellStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {

  }
}

document.addEventListener('alpine:init', () => {
  Alpine.data('appShell', () => ({
    sidebarOpen: true,
    panelOpen: true,
    wide: true,

    panelName: 'panel',
    resizeFrame: 0,
    resizeHandler: null,

    get sidebarExpanded() {
      return this.sidebarOpen ? 'true' : 'false';
    },
    get sidebarLabel() {
      return this.sidebarOpen ? 'Hide sidebar' : 'Show sidebar';
    },
    get panelExpanded() {
      return this.panelOpen ? 'true' : 'false';
    },
    get panelLabel() {
      return `${this.panelOpen ? 'Hide' : 'Show'} ${this.panelName.toLowerCase()}`;
    },

    get scrimVisible() {
      return !this.wide && (this.sidebarOpen || this.panelOpen);
    },

    apply() {
      const root = document.documentElement;
      root.classList.toggle('sidebar-closed', !this.sidebarOpen);
      root.classList.toggle('panel-closed', !this.panelOpen);
      document.body.classList.toggle('is-modal-open', this.scrimVisible);
      const sidebar = document.getElementById('app-sidebar');
      const panel = document.getElementById('app-panel');
      if (sidebar) sidebar.inert = !this.sidebarOpen;
      if (panel) panel.inert = !this.panelOpen;
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
      if (this.wide) shellStore(SIDEBAR_KEY, this.sidebarOpen ? 'open' : 'closed');
      else if (this.sidebarOpen) this.panelOpen = false;
      this.apply();
      this.focusToggle(this.sidebarOpen ? 'sidebar-collapse' : 'sidebar-toggle');
    },
    closeDrawer() {
      if (this.wide || (!this.sidebarOpen && !this.panelOpen)) return;
      const toggle = document.getElementById(this.sidebarOpen ? 'sidebar-toggle' : 'panel-toggle');
      this.sidebarOpen = false;
      this.panelOpen = false;
      this.apply();
      if (toggle) toggle.focus();
    },

    onSidebarTouchStart(event) {
      if (this.wide || !this.sidebarOpen || event.touches.length !== 1) return;
      swipe = { x: event.touches[0].clientX, y: event.touches[0].clientY, dx: 0, live: false };
    },
    onSidebarTouchMove(event) {
      if (!swipe) return;
      const dx = event.touches[0].clientX - swipe.x;
      const dy = event.touches[0].clientY - swipe.y;
      if (!swipe.live && Math.abs(dy) > Math.abs(dx)) {
        swipe = null;
        return;
      }
      swipe.live = true;
      swipe.dx = Math.min(0, dx);
      this.$el.style.transition = 'none';
      this.$el.style.transform = `translateX(${swipe.dx}px)`;
    },
    onSidebarTouchEnd() {
      if (!swipe) return;
      const close = swipe.dx < -SWIPE_CLOSE_PX;
      swipe = null;
      this.$el.style.transition = '';
      this.$el.style.transform = '';
      if (close) this.closeDrawer();
    },

    onSidebarClick(event) {
      if (!this.wide && event.target.closest('a')) {
        this.sidebarOpen = false;
        this.apply();
      }
    },

    togglePanel() {
      this.panelOpen = !this.panelOpen;
      if (this.wide) shellStore(PANEL_KEY, this.panelOpen ? 'open' : 'closed');
      else if (this.panelOpen) this.sidebarOpen = false;
      this.apply();
      this.focusToggle(this.panelOpen ? 'panel-collapse' : 'panel-toggle');
    },

    focusToggle(id) {
      this.$nextTick(() => requestAnimationFrame(() => {
        const target = document.getElementById(id);
        if (target && target.checkVisibility()) target.focus({ preventScroll: true });
      }));
    },

    syncWidth(wide) {
      this.wide = wide;
      this.sidebarOpen = wide && shellStored(SIDEBAR_KEY) !== 'closed';
      this.panelOpen = wide && shellStored(PANEL_KEY) !== 'closed';
      this.apply();
    },

    onViewportResize() {
      const root = document.documentElement;
      root.classList.add('is-resizing');
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = requestAnimationFrame(() => {
          root.classList.remove('is-resizing');
          this.resizeFrame = 0;
        });
      });
    },

    onKeydown(event) {
      if (event.key === 'Escape') {
        this.closeDrawer();
        return;
      }

      if (event.key === '\\' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        this.toggleSidebar();
      }
    },

    onPanelClick(event) {
      if (!this.wide && this.panelOpen && event.target.closest('#app-panel a, #why-pop a')) {
        this.panelOpen = false;
        this.apply();
      }
    },

    init() {
      const root = document.documentElement;
      const query = window.matchMedia(SHELL_WIDE);
      this.wide = query.matches;
      this.sidebarOpen = !root.classList.contains('sidebar-closed');
      this.panelOpen = !root.classList.contains('panel-closed');
      const panelToggle = document.getElementById('panel-toggle');
      if (panelToggle) this.panelName = panelToggle.dataset.panel || 'panel';
      this.apply();
      this.resizeHandler = () => this.onViewportResize();
      window.addEventListener('resize', this.resizeHandler, { passive: true });
      query.addEventListener('change', (e) => this.syncWidth(e.matches));
      window.addEventListener('keydown', (e) => this.onKeydown(e));
      document.addEventListener('click', (e) => this.onPanelClick(e));
    },
    destroy() {
      cancelAnimationFrame(this.resizeFrame);
      window.removeEventListener('resize', this.resizeHandler);
      document.documentElement.classList.remove('is-resizing');
    },
  }));
});
