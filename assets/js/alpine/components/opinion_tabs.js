const VALID_TABS = ['opinion', 'authorities', 'cited-by', 'history'];
const ACTIVE_TAB_CLASS = 'is-active';
const INACTIVE_TAB_CLASS = '';
const TOP_SHOW_AFTER = 480;

// The page owns tab navigation and one shared overlay scheduler. Feature state is per reader.
document.addEventListener('alpine:init', () => {
  Alpine.data('opinionTabs', () => {
    const lifecycle = createReaderLifecycle();
    let initialized = false;
    let overlayFrame = 0;
    return composeReaderFeatures({
      activeTab: 'opinion',
      tabFrame: 0,
      tabRevision: 0,
      panelSummary: false,
      pageRoot: null,
      backToTopVisible: false,
      lastScrollY: 0,
      downwardScroll: 0,
      get tabSelected() {
        return this.$el.dataset.tab === this.activeTab ? 'true' : 'false';
      },
      get tabIndex() {
        return this.$el.dataset.tab === this.activeTab ? 0 : -1;
      },
      get tabClass() {
        return this.$el.dataset.tab === this.activeTab ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS;
      },
      get tabCountClass() {
        return this.$el.dataset.tab === this.activeTab ? 'tab-count--active' : '';
      },
      get panelVisible() {
        return this.$el.dataset.tab === this.activeTab;
      },
      get panelViewClass() {
        const view = this.panelSummary ? 'opinion' : this.activeTab;
        return this.$el.dataset.view === view ? 'is-current' : '';
      },
      get panelBackVisible() {
        return this.panelSummary && this.activeTab !== 'opinion';
      },
      get panelBackLabel() {
        return this.activeTab === 'history' ? 'Display' : 'Narrow by';
      },
      showPanelSummary() {
        this.panelSummary = true;
      },
      showPanelView() {
        this.panelSummary = false;
      },
      enterTab(id, hash = id) {
        if (!VALID_TABS.includes(id)) return;
        lifecycle.cancelFrame(this.tabFrame);
        this.tabRevision += 1;
        if (id !== this.activeTab) history.pushState(null, '', `#${hash}`);
        else history.replaceState(null, '', `#${hash}`);
        this.activeTab = id;
      },
      showTab(id) {
        if (!VALID_TABS.includes(id) || id === this.activeTab) return;
        if (id !== 'opinion' && this.findOpen) this.setFind(false, false);
        if (id !== 'opinion' && this.occNav.open) this.occClose();
        const panel = document.getElementById(`panel-${this.activeTab}`);
        const y = window.scrollY;
        const limit = panel ? Math.max(0, panel.parentElement.getBoundingClientRect().top + y - readerHeaderBottom(this.pageRoot) - 16) : y;
        const top = Math.min(y, limit);
        window.scrollTo({ top, behavior: 'instant' });
        this.enterTab(id);
        const revision = this.tabRevision;
        lifecycle.nextTick(this, () => {
          if (revision !== this.tabRevision) return;
          this.tabFrame = lifecycle.frame(() => {
            if (revision !== this.tabRevision) return;
            this.tabFrame = 0;
            const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo({ top: Math.min(top, max), behavior: 'instant' });
          });
        });
      },
      selectTab() {
        this.showTab(this.$el.dataset.tab);
      },
      tabForHash(hash) {
        if (VALID_TABS.includes(hash)) return hash;
        if (hash === 'panel-opinion' || hash.startsWith('section-') || hash.startsWith('q=') || hash.startsWith('fn')) return 'opinion';
        if (hash.startsWith('authority-')) return 'authorities';
        if (hash.startsWith('citing-')) return 'cited-by';
        return null;
      },
      onHashLinkClick(event) {
        const link = event.target.closest('a[href^="#"]');
        if (!link || link.matches('a.cited-case-wrap')) return;
        const hash = link.getAttribute('href').slice(1);
        const tab = this.tabForHash(hash);
        if (tab && tab !== this.activeTab) this.enterTab(tab, hash);
      },
      onKeydown(event) {
        const tabs = Array.from(this.pageRoot.querySelectorAll('[role="tab"]'));
        const current = tabs.findIndex((t) => t.dataset.tab === this.activeTab);
        let next = current;
        switch (event.key) {
          case 'ArrowRight':
            next = (current + 1) % tabs.length;
            break;
          case 'ArrowLeft':
            next = (current - 1 + tabs.length) % tabs.length;
            break;
          case 'Home':
            next = 0;
            break;
          case 'End':
            next = tabs.length - 1;
            break;
          default:
            return;
        }
        event.preventDefault();
        this.showTab(tabs[next].dataset.tab);
        tabs[next].focus({ preventScroll: true });
      },
      handleHash(hash) {
        lifecycle.cancelFrame(this.tabFrame);
        this.tabRevision += 1;
        if (!hash) {
          this.activeTab = VALID_TABS[0];
        } else if (VALID_TABS.includes(hash)) {
          this.activeTab = hash;
        } else if (hash.startsWith('q=')) {
          let quote = '';
          try {
            quote = decodeURIComponent(hash.slice(2));
          } catch (e) {
            quote = '';
          }
          if (quote) this.flashQuoteInBody(quote);
        } else if (hash.startsWith('fn-') || hash.startsWith('fnref-')) {
          this.activeTab = 'opinion';
          lifecycle.nextTick(this, () =>
            lifecycle.frame(() => {
              const el = document.getElementById(hash);
              if (el) highlightElement(hash.startsWith('fn-') ? el : el.querySelector('a') || el, 'row-flash');
            })
          );
        } else if (hash.startsWith('section-')) {
          this.activeTab = 'opinion';
          lifecycle.nextTick(this, () => {
            const el = document.getElementById(hash);
            if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
          });
        } else if (hash.startsWith('authority-') || hash.startsWith('citing-')) {
          this.activeTab = hash.startsWith('citing-') ? 'cited-by' : 'authorities';

          lifecycle.nextTick(this, () =>
            lifecycle.frame(() =>
              lifecycle.frame(() => highlightElement(document.getElementById(hash), 'row-flash'))
            )
          );
        }
      },
      get docLayoutClass() {
        return this.activeTab === 'opinion' ? 'is-reading' : '';
      },
      get backToTopClass() {
        return this.backToTopVisible ? 'is-visible' : '';
      },
      get backToTopTab() {
        return this.backToTopVisible ? 0 : -1;
      },
      occFollow() {
        if ((!this.occNav.open && !this.fn.open && !this.whyOpen && !this.selOpen) || overlayFrame) return;
        overlayFrame = lifecycle.frame(() => {
          overlayFrame = 0;
          this.occLocate();
          this.fnLocate();
          this.whyLocate();
          this.selLocate();
        });
      },
      positionBackToTop() {
        const dock = this.pageRoot?.querySelector('.back-to-top-dock');
        const footer = document.getElementById('footer');
        if (!dock?.style || !footer) return;
        const overlap = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
        dock.style.setProperty('--footer-overlap', `${overlap}px`);
      },
      onPageScroll() {
        this.positionBackToTop();
        const y = Math.max(0, window.scrollY);
        const delta = y - this.lastScrollY;
        this.lastScrollY = y;
        if (y <= TOP_SHOW_AFTER) {
          this.backToTopVisible = false;
          this.downwardScroll = 0;
        } else if (delta < -1) {
          this.backToTopVisible = true;
          this.downwardScroll = 0;
        } else if (delta > 0) {
          this.downwardScroll += delta;
          if (this.downwardScroll > 32) this.backToTopVisible = false;
        }
      },
      init() {
        if (initialized || !lifecycle.active) return;
        initialized = true;
        this.pageRoot = this.$root;
        this.handleHash(window.location.hash.slice(1));
        this.$watch('activeTab', () => { this.panelSummary = false; });
        lifecycle.listen(window, 'hashchange', () => this.handleHash(window.location.hash.slice(1)));
        lifecycle.listen(this.pageRoot, 'click', (event) => this.onHashLinkClick(event));
        this.initReaderFind();
        this.initReaderCitations();
        this.initReaderPopovers();
        this.initReaderSelection();
        lifecycle.listen(window, 'scroll', () => this.occFollow(), { passive: true, capture: true });
        lifecycle.listen(window, 'scroll', () => this.onPageScroll(), { passive: true });
        lifecycle.listen(window, 'resize', () => {
          this.occFollow();
          this.positionBackToTop();
        });
        this.positionBackToTop();
        this.lastScrollY = window.scrollY;
        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(() => this.occFollow());
          observer.observe(this.$refs.occCard);
          lifecycle.cleanup(() => observer.disconnect());
        }
      },
      destroy() {
        lifecycle.destroy();
        lifecycle.cancelFrame(this.tabFrame);
        lifecycle.cancelFrame(overlayFrame);
      },
    }, {
      find: createReaderFind(lifecycle),
      citations: createReaderCitations(lifecycle),
      popovers: createReaderPopovers(lifecycle),
      selection: createReaderSelection(lifecycle),
    });
  });
});
