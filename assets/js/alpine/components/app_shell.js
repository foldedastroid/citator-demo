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
    sidebarDrag: null,
    sidebarPeek: false,
    sidebarPeekSuppressed: false,
    sidebarPeekTimer: 0,
    panelOpen: true,
    wide: true,

    panelName: 'panel',
    resizeFrame: 0,
    resizeHandler: null,
    sidebarDismissHandler: null,

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
      root.classList.toggle('sidebar-peeking', this.wide && this.sidebarPeek && !this.sidebarOpen);
      root.classList.toggle('panel-closed', !this.panelOpen);
      document.body.classList.toggle('is-modal-open', this.scrimVisible);
      const sidebar = document.getElementById('app-sidebar');
      const panel = document.getElementById('app-panel');
      if (sidebar) sidebar.inert = !(this.sidebarOpen || (this.wide && this.sidebarPeek));
      if (panel) panel.inert = !this.panelOpen;
    },

    holdSidebarPeek() {
      clearTimeout(this.sidebarPeekTimer);
      if (!this.wide || this.sidebarOpen || this.sidebarDrag || this.sidebarPeekSuppressed) return;
      this.sidebarPeek = true;
      this.apply();
    },
    releaseSidebarPeek(event) {
      const next = event?.relatedTarget;
      if (next?.closest?.('#app-sidebar, .sidebar-drag-edge')) return;
      this.sidebarPeekSuppressed = false;
      clearTimeout(this.sidebarPeekTimer);
      if (!this.sidebarPeek || this.sidebarDrag) return;
      this.sidebarPeekTimer = setTimeout(() => {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar?.contains(document.activeElement)) return;
        this.sidebarPeek = false;
        this.apply();
      }, 180);
    },
    clearSidebarPeek() {
      clearTimeout(this.sidebarPeekTimer);
      this.sidebarPeek = false;
    },

    dismissSidebarPeek(event) {
      if (!this.sidebarPeek || this.sidebarDrag) return;
      if (event.target?.closest?.('#app-sidebar, .sidebar-drag-edge')) return;
      this.clearSidebarPeek();
      this.apply();
    },

    startSidebarDrag(event) {
      if (!this.wide || event.button !== 0) return;
      const sidebar = document.getElementById('app-sidebar');
      if (!sidebar) return;
      event.preventDefault();
      const visible = this.sidebarOpen || this.sidebarPeek;
      this.clearSidebarPeek();
      const width = sidebar.getBoundingClientRect().width;
      this.sidebarDrag = { id: event.pointerId, x: event.clientX, width,
        start: visible ? width : 0, value: visible ? width : 0,
        open: this.sidebarOpen, moved: false, target: event.currentTarget };
      event.currentTarget.setPointerCapture(event.pointerId);
      const root = document.documentElement;
      root.style.setProperty('--sidebar-drag-width', `${this.sidebarDrag.start}px`);
      root.classList.add('is-sidebar-dragging');
    },
    moveSidebarDrag(event) {
      const drag = this.sidebarDrag;
      if (!drag || event.pointerId !== drag.id) return;
      drag.moved ||= Math.abs(event.clientX - drag.x) > 4;
      drag.value = Math.max(0, Math.min(drag.width, drag.start + event.clientX - drag.x));
      document.documentElement.style.setProperty('--sidebar-drag-width', `${drag.value}px`);
    },
    finishSidebarDrag(cancelled) {
      const drag = this.sidebarDrag;
      if (!drag) return;
      this.sidebarDrag = null;
      this.sidebarOpen = cancelled ? drag.open : !drag.moved ? !drag.open : drag.value >= drag.width / 2;
      this.sidebarPeekSuppressed = !this.sidebarOpen;
      const root = document.documentElement;
      root.classList.remove('is-sidebar-dragging');
      root.style.removeProperty('--sidebar-drag-width');
      if (drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id);
      if (!cancelled) shellStore(SIDEBAR_KEY, this.sidebarOpen ? 'open' : 'closed');
      this.apply();
    },
    endSidebarDrag(event) {
      this.moveSidebarDrag(event);
      this.finishSidebarDrag(false);
    },
    cancelSidebarDrag() {
      this.finishSidebarDrag(true);
    },

    toggleSidebar(event) {
      this.clearSidebarPeek();
      this.sidebarOpen = !this.sidebarOpen;
      this.sidebarPeekSuppressed = !this.sidebarOpen;
      if (this.wide) shellStore(SIDEBAR_KEY, this.sidebarOpen ? 'open' : 'closed');
      else if (this.sidebarOpen) this.panelOpen = false;
      this.apply();
      if (!event || event.detail === 0) {
        this.focusToggle(this.sidebarOpen ? 'sidebar-collapse' : 'sidebar-toggle');
      }
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
      if ((!this.wide || this.sidebarPeek) && event.target.closest('a')) {
        this.clearSidebarPeek();
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
      this.clearSidebarPeek();
      this.wide = wide;
      this.sidebarOpen = wide && shellStored(SIDEBAR_KEY) !== 'closed';
      this.panelOpen = wide && shellStored(PANEL_KEY) !== 'closed';
      this.apply();
    },

    onViewportResize() {
      this.cancelSidebarDrag();
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
        this.clearSidebarPeek();
        this.apply();
        this.cancelSidebarDrag();
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
      this.sidebarDismissHandler = (event) => this.dismissSidebarPeek(event);
      document.addEventListener('wheel', this.sidebarDismissHandler, { passive: true });
      document.addEventListener('pointerdown', this.sidebarDismissHandler);
      this.resizeHandler = () => this.onViewportResize();
      window.addEventListener('resize', this.resizeHandler, { passive: true });
      query.addEventListener('change', (e) => this.syncWidth(e.matches));
      window.addEventListener('keydown', (e) => this.onKeydown(e));
      document.addEventListener('click', (e) => this.onPanelClick(e));
    },
    destroy() {
      this.clearSidebarPeek();
      this.cancelSidebarDrag();
      cancelAnimationFrame(this.resizeFrame);
      window.removeEventListener('resize', this.resizeHandler);
      document.removeEventListener('wheel', this.sidebarDismissHandler);
      document.removeEventListener('pointerdown', this.sidebarDismissHandler);
      document.documentElement.classList.remove('is-resizing');
    },
  }));
});
