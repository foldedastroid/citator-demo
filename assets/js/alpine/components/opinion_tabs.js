const VALID_TABS = ['opinion', 'authorities', 'cited-by', 'history'];
const ACTIVE_TAB_CLASS = 'is-active';
const INACTIVE_TAB_CLASS = '';

const OCC_WIDTH = 272;
const OCC_GAP = 7;
const OCC_EDGE = 8;
const OCC_OPEN_MS = 180;
const OCC_CLOSE_MS = 160;
const FN_WIDTH = 280;
let fnAnchor = null;
const QUOTE_FLASH_MS = 3500;


const NON_PROSE = '.cited-case__severity, sup.fnref';

const TIERS = ['stop', 'warning', 'caution', 'positive', 'neutral'];


const EMPTY_ROW ={ rationale: '', quote: '', hasAnalysis: false, item: 0, items: 0 };
let occItems = [];
const TOP_SHOW_AFTER = 480;
const TOAST_MS = 4000;
let findHits = [];
let findMotion = null;
let selText = '';

document.addEventListener('alpine:init', () => {
  Alpine.data('opinionTabs', () => ({
    activeTab: 'opinion',
    tabFrame: 0,
    tabRevision: 0,

    panelSummary: false,



    pageRoot: null,

    occNav: { open: false, n: 0, name: '', url: '', index: 0, total: 0, ...EMPTY_ROW },

    occPos: { left: 0, top: 0, width: OCC_WIDTH, below: false, originX: 0 },
    occFrame: 0,
    occOpenTimer: 0,
    occCloseTimer: 0,

    occSuppressFocus: false,
    backToTopVisible: false,
    whyOpen: false,
    selOpen: false,
    selPos: { left: 0, top: 0 },
    whyPos: { left: 0, top: 0, width: OCC_WIDTH },
    find: { query: '', index: 0, total: 0 },
    findOpen: false,
    findExcerpts: true,
    findVisible: false,
    findRevision: 0,

    findBox: null,
    lastScrollY: 0,
    fn: { open: false, label: '', href: '#' },
    fnPos: { left: 0, top: 0, width: FN_WIDTH },

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
      cancelAnimationFrame(this.tabFrame);
      this.tabRevision += 1;
      if (id !== this.activeTab) history.pushState(null, '', `#${hash}`);
      else history.replaceState(null, '', `#${hash}`);
      this.activeTab = id;
    },
    showTab(id) {
      if (!VALID_TABS.includes(id) || id === this.activeTab) return;
      if (id !== 'opinion' && this.findOpen) this.setFind(false, false);
      const panel = document.getElementById(`panel-${this.activeTab}`);
      const y = window.scrollY;
      const limit = panel ? Math.max(0, panel.parentElement.getBoundingClientRect().top + y - stickyBottom() - 16) : y;
      const top = Math.min(y, limit);
      window.scrollTo({ top, behavior: 'instant' });
      this.enterTab(id);
      const revision = this.tabRevision;
      this.$nextTick(() => {
        if (revision !== this.tabRevision) return;
        this.tabFrame = requestAnimationFrame(() => {
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
      cancelAnimationFrame(this.tabFrame);
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
        this.$nextTick(() =>
          requestAnimationFrame(() => {
            const el = document.getElementById(hash);
            if (el) highlightElement(hash.startsWith('fn-') ? el : el.querySelector('a') || el, 'row-flash');
          })
        );
      } else if (hash.startsWith('section-')) {
        this.activeTab = 'opinion';
        this.$nextTick(() => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        });
      } else if (hash.startsWith('authority-') || hash.startsWith('citing-')) {
        this.activeTab = hash.startsWith('citing-') ? 'cited-by' : 'authorities';

        this.$nextTick(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => highlightElement(document.getElementById(hash), 'row-flash'))
          )
        );
      }
    },

    readQuote() {
      this.flashQuoteInBody(this.$el.dataset.quote || '');
    },


    onCitationClick(event) {
      const link = event.target.closest('a.cited-case-wrap');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#authority-')) return;
      event.preventDefault();
      this.occOpen(link);
    },

    get occNavOpen() {
      return this.occNav.open;
    },

    get occNavClass() {
      return this.occNav.open ? 'is-open' : '';
    },
    get occNavStyle() {
      return {
        left: `${this.occPos.left}px`,
        top: `${this.occPos.top}px`,
        width: `${this.occPos.width}px`,
        transformOrigin: `${this.occPos.originX}px ${this.occPos.below ? 'top' : 'bottom'}`,
      };
    },
    get occNavName() {
      return this.occNav.name;
    },
    get occNavUrl() {
      return this.occNav.url;
    },
    get occNavHasUrl() {
      return this.occNav.url !== '';
    },
    get occNavNoUrl() {
      return this.occNav.url === '';
    },
    get occNavCount() {
      if (!this.occNav.total) return '';
      if (this.occNav.total === 1) return 'Only mention';
      return `Mention ${this.occNav.index + 1} of ${this.occNav.total}`;
    },

    get occNavMany() {
      return this.occNav.total > 1;
    },
    get occNavRationale() {
      return this.occNav.rationale;
    },
    get occNavHasAnalysis() {
      return this.occNav.hasAnalysis;
    },
    get occNavQuote() {
      return this.occNav.quote;
    },
    get occNavHasQuote() {
      return this.occNav.hasAnalysis && this.occNav.quote !== '';
    },
    get occNavOne() {
      return this.occNav.total === 1;
    },
    get occMentionPos() {
      return `${this.occNav.index + 1} / ${this.occNav.total}`;
    },
    get occItemMany() {
      return this.occNav.items > 1;
    },
    get occItemPos() {
      return `${this.occNav.item + 1} / ${this.occNav.items}`;
    },
    get docLayoutClass() {
      return this.activeTab === 'opinion' ? 'is-reading' : '';
    },
    get findClosed() {
      return !this.findOpen;
    },
    get findResults() {
      return this.findOpen && this.find.query.length > 0;
    },
    get findExcerptResults() {
      return this.findResults && this.findExcerpts;
    },
    findReveal() {
      this.findExcerpts = true;
    },
    get findMany() {
      return this.find.total > 1;
    },
    get findPos() {
      if (this.find.query.length < 2) return 'Type at least two characters';
      return this.find.total ? `${this.find.index + 1} of ${this.find.total}` : 'No matches';
    },
    get findClass() {
      return this.findOpen ? 'is-open' : '';
    },
    get findExpanded() {
      return this.findOpen ? 'true' : 'false';
    },
    get findStyle() {
      return this.findBox ? { '--find-width': `${this.findBox.width}px`, '--find-results-height': `${this.findBox.height}px` } : {};
    },
    findTrigger() {
      return this.$refs.findButton;
    },
    findPlace() {
      const anchor = this.$refs.findAnchor;
      if (!anchor || anchor.offsetParent === null) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.max(32, Math.min(320, window.innerWidth - rect.left - OCC_EDGE));
      const height = Math.max(0, window.innerHeight - rect.bottom - OCC_EDGE);
      if (!this.findBox || this.findBox.width !== width || this.findBox.height !== height) {
        if (findMotion && this.findBox?.width !== width) findMotion.finish();
        this.findBox = { width, height };
      }
    },
    focusFind() {
      this.$refs.findInput.focus({ preventScroll: true });
    },
    setFind(open, focus = true) {
      if (open === this.findOpen) {
        if (open && !findMotion && focus) this.focusFind();
        return;
      }
      const card = this.$refs.findCard;
      const from = card.getBoundingClientRect().width;
      this.findPlace();
      this.findOpen = open;
      this.findVisible = open;
      const revision = ++this.findRevision;
      if (findMotion) findMotion.cancel();
      findMotion = null;
      this.$nextTick(() => {
        if (revision !== this.findRevision) return;
        this.findPlace();
        const target = open ? this.findBox.width : 32;
        const settle = () => {
          if (revision !== this.findRevision) return;
          findMotion = null;
          if (open && focus) this.focusFind();
        };
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !card.animate) {
          settle();
          return;
        }
        const style = getComputedStyle(card);
        const motion = card.animate([{ width: `${from}px` }, { width: `${target}px` }], {
          duration: (parseFloat(style.getPropertyValue('--find-duration')) || 200) * Math.max(0.2, Math.abs(target - from) / Math.max(1, this.findBox.width - 32)),
          easing: style.getPropertyValue('--find-ease').trim() || 'ease-out',
          fill: 'both',
        });
        findMotion = motion;
        motion.finished.then(() => {
          settle();
          motion.cancel();
        }).catch(() => {});
      });
    },
    openFind() {
      if (this.activeTab !== 'opinion') this.showTab('opinion');
      this.$nextTick(() => this.setFind(true));
    },
    toggleFind() {
      if (this.findOpen) this.closeFind();
      else this.openFind();
    },
    closeFind() {
      if (!this.findOpen) return;
      this.setFind(false);
      this.findTrigger()?.focus({ preventScroll: true });
    },
    findClickOutside(event) {
      if (!this.findOpen || this.findTrigger()?.contains(event.target) || this.find.query) return;
      this.setFind(false, false);
    },
    get whyClass() {
      return this.whyOpen ? 'is-open' : '';
    },
    get whyStyle() {
      return { left: `${this.whyPos.left}px`, top: `${this.whyPos.top}px`, width: `${this.whyPos.width}px` };
    },
    get whyExpanded() {
      return this.whyOpen ? 'true' : 'false';
    },
    toggleWhy(event) {
      if (this.whyOpen) {
        this.closeWhy();
        return;
      }
      this.whyOpen = true;
      this.$nextTick(() => {
        this.whyLocate();
        if (event?.detail === 0) this.$refs.whyCard.querySelector('button').focus({ preventScroll: true });
      });
    },
    whyLocate() {
      if (!this.whyOpen) return;
      const rect = this.$refs.whyButton.getBoundingClientRect();
      const card = this.$refs.whyCard;
      const width = Math.min(OCC_WIDTH, window.innerWidth - OCC_EDGE * 2);
      const height = card.offsetHeight || 160;
      const fitsBelow = rect.bottom + OCC_GAP + height + OCC_EDGE <= window.innerHeight;
      const left = Math.min(window.innerWidth - width - OCC_EDGE, Math.max(OCC_EDGE, rect.right - width));
      const top = fitsBelow ? rect.bottom + OCC_GAP : Math.max(OCC_EDGE, rect.top - height - OCC_GAP);
      this.whyPos = { left: Math.round(left), top: Math.round(top), width };
    },
    closeWhy() {
      if (!this.whyOpen) return;
      const inside = this.$refs.whyCard.contains(document.activeElement);
      this.whyOpen = false;
      if (inside) this.$refs.whyButton.focus({ preventScroll: true });
    },
    whyClickOutside(event) {
      if (event.target === this.$refs.whyButton) return;
      this.whyOpen = false;
    },
    get backToTopClass() {
      return this.backToTopVisible ? 'is-visible' : '';
    },
    get backToTopTab() {
      return this.backToTopVisible ? 0 : -1;
    },
    get occNavOnlyCited() {
      return this.occNav.open && !this.occNav.hasAnalysis;
    },



    occRowLead(n) {
      const row = document.getElementById(`authority-${n}`);
      const plain = this.$refs.occPillsPlain;
      occItems = [];
      plain.replaceChildren();
      if (!row) return { ...EMPTY_ROW };
      row.querySelectorAll('.evidence-card').forEach((card, order) => {
        const pill = card.querySelector('.severity-badge');
        const found = TIERS.findIndex((t) => pill && pill.classList.contains(`severity-badge--${t}`));
        const rationale = card.querySelector('.evidence-card__rationale');
        const quote = card.querySelector('.evidence-card__quote-text');
        occItems.push({
          tier: found < 0 ? TIERS.length : found,
          order,
          pill,
          rationale: rationale ? rationale.textContent.trim() : '',
          quote: quote ? quote.textContent.trim() : '',
        });
      });
      occItems.sort((x, y) => x.tier - y.tier || x.order - y.order);
      if (!occItems.length) {
        const pill = row.querySelector('.citator-row__treatment .severity-badge');
        if (pill) plain.replaceChildren(this.occPillCopy(pill));
        return { ...EMPTY_ROW };
      }
      return { ...this.occItemAt(0), hasAnalysis: true, items: occItems.length };
    },
    occPillCopy(pill) {
      const copy = pill.cloneNode(true);
      copy.classList.remove('severity-badge--defined');
      copy.removeAttribute('tabindex');
      copy.querySelectorAll('.pill-tip').forEach((tip) => tip.remove());
      return copy;
    },
    occItemAt(i) {
      const item = occItems[i];
      this.$refs.occPills.replaceChildren(...(item && item.pill ? [this.occPillCopy(item.pill)] : []));
      return { item: i, rationale: item ? item.rationale : '', quote: item ? item.quote : '' };
    },
    occItemStep(delta) {
      if (occItems.length < 2) return;
      const next = (this.occNav.item + delta + occItems.length) % occItems.length;
      Object.assign(this.occNav, this.occItemAt(next));
      this.$nextTick(() => this.occLocate());
    },
    occItemNext() {
      this.occItemStep(1);
    },
    occItemPrev() {
      this.occItemStep(-1);
    },

    occMentions(n) {
      return Array.from(this.pageRoot.querySelectorAll(`.opinion-body a.cited-case-wrap[data-group="${n}"]`));
    },

    occOpen(link) {
      this.occHold();
      const n = parseInt(link.dataset.group, 10);
      const mentions = this.occMentions(n);
      if (!mentions.length) return;
      const index = Math.max(0, mentions.indexOf(link));
      if (this.occNav.open && this.occNav.n === n && this.occNav.index === index) return;
      this.occNav = {
        open: true,
        n,
        name: link.dataset.name || '',
        url: link.dataset.url || '',
        index,
        total: mentions.length,
        ...this.occRowLead(n),
      };

      this.$nextTick(() => this.occLocate());
    },

    occShow() {
      highlightElement(this.occCurrent(), 'mention-flash');
      this.$nextTick(() => this.occLocate());
    },
    occCurrent() {
      return this.occMentions(this.occNav.n)[this.occNav.index] || null;
    },

    occLocate() {
      if (!this.occNav.open) return;
      const mention = this.occCurrent();
      const card = this.$refs.occCard;
      if (!mention || !card) return;
      const rect = mention.getBoundingClientRect();
      const width = Math.min(OCC_WIDTH, window.innerWidth - OCC_EDGE * 2);
      const height = card.offsetHeight || 180;
      const topbar = stickyBottom();
      const below = rect.top - topbar <= height + 12;
      const left = Math.min(
        window.innerWidth - width - OCC_EDGE,
        Math.max(OCC_EDGE, rect.left + rect.width / 2 - width / 2)
      );
      const top = Math.max(
        OCC_EDGE,
        Math.min(window.innerHeight - height - OCC_EDGE, below ? rect.bottom + OCC_GAP : rect.top - height - OCC_GAP)
      );
      const originX = Math.max(0, Math.min(width, rect.left + rect.width / 2 - left));
      this.occPos = { left: Math.round(left), top: Math.round(top), width, below, originX: Math.round(originX) };
    },

    occFollow() {
      if ((!this.occNav.open && !this.fn.open && !this.whyOpen && !this.selOpen) || this.occFrame) return;
      this.occFrame = requestAnimationFrame(() => {
        this.occFrame = 0;
        this.occLocate();
        this.fnLocate();
        this.whyLocate();
        this.selLocate();
      });
    },
    occNext() {
      if (!this.occNav.total) return;
      this.occNav.index = (this.occNav.index + 1) % this.occNav.total;
      this.occShow();
    },
    occPrev() {
      if (!this.occNav.total) return;
      this.occNav.index = (this.occNav.index - 1 + this.occNav.total) % this.occNav.total;
      this.occShow();
    },
    occToRow() {
      const hash = `authority-${this.occNav.n}`;
      this.enterTab('authorities', hash);
      this.handleHash(hash);
    },
    occClose() {
      this.occClearTimers();
      this.occNav = { open: false, n: 0, name: '', url: '', index: 0, total: 0, ...EMPTY_ROW };
      this.$refs.occPills.replaceChildren();
      this.$refs.occPillsPlain.replaceChildren();
      occItems = [];
    },

    occEscape() {
      if (!this.occNav.open) return;
      const mention = this.occCurrent();
      const card = this.$refs.occCard;
      const focusInside = card.contains(document.activeElement) || document.activeElement === mention;
      this.occClose();
      if (mention && focusInside) {
        this.occSuppressFocus = true;
        mention.focus({ preventScroll: true });
        queueMicrotask(() => {
          this.occSuppressFocus = false;
        });
      }
    },

    get fnClass() {
      return this.fn.open ? 'is-open' : '';
    },
    get fnStyle() {
      return { left: `${this.fnPos.left}px`, top: `${this.fnPos.top}px`, width: `${this.fnPos.width}px` };
    },
    get fnAria() {
      const n = (this.fn.label || '').replace(/[[\]]/g, '').trim();
      return n ? `Footnote ${n}` : 'Footnote';
    },
    get fnHref() {
      return this.fn.href;
    },
    onFootnoteClick(event) {
      const link = event.target.closest('.opinion-body sup.fnref a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute('href').slice(1);
      const item = document.getElementById(id);
      const body = item && item.querySelector('.fn-body');
      if (!body) return;
      event.preventDefault();
      if (this.fn.open && fnAnchor === link) {
        this.fnClose();
        return;
      }
      this.occClose();
      fnAnchor = link;
      this.$refs.fnBody.replaceChildren(...Array.from(body.childNodes, (n) => n.cloneNode(true)));
      this.fn = { open: true, label: `[${link.textContent.trim()}]`, href: `#${id}` };
      this.$nextTick(() => {
        this.fnLocate();
        if (event.detail === 0) this.$refs.fnCard.querySelector('button').focus({ preventScroll: true });
      });
    },
    fnLocate() {
      if (!this.fn.open || !fnAnchor) return;
      const rect = fnAnchor.getBoundingClientRect();
      const card = this.$refs.fnCard;
      const width = Math.min(FN_WIDTH, window.innerWidth - OCC_EDGE * 2);
      const height = card.offsetHeight || 160;
      const fitsBelow = rect.bottom + OCC_GAP + height + OCC_EDGE <= window.innerHeight;
      const left = Math.min(window.innerWidth - width - OCC_EDGE, Math.max(OCC_EDGE, rect.left - 12));
      const top = fitsBelow ? rect.bottom + OCC_GAP : Math.max(OCC_EDGE, rect.top - height - OCC_GAP);
      this.fnPos = { left: Math.round(left), top: Math.round(top), width };
    },
    fnClose() {
      this.fn = { open: false, label: '', href: this.fn.href };
      this.$refs.fnBody.replaceChildren();
    },
    fnEscape() {
      if (!this.fn.open) return;
      const back = this.$refs.fnCard.contains(document.activeElement) ? fnAnchor : null;
      this.fnClose();
      if (back) back.focus({ preventScroll: true });
    },
    fnClickOutside(event) {
      if (event.target.closest('.opinion-body sup.fnref')) return;
      this.fnClose();
    },

    onPageScroll() {
      const y = window.scrollY;
      const delta = y - this.lastScrollY;
      if (Math.abs(delta) < 4) return;
      this.lastScrollY = y;
      const visible = y > TOP_SHOW_AFTER && delta < 0;
      if (visible !== this.backToTopVisible) this.backToTopVisible = visible;
    },

    copyCitation() {
      copyText(this.$el.dataset.cite || '', 'Citation copied');
    },

    get selClass() {
      return this.selOpen ? 'is-open' : '';
    },
    get selStyle() {
      return { left: `${this.selPos.left}px`, top: `${this.selPos.top}px` };
    },
    onSelection() {
      const selection = window.getSelection();
      const body = this.pageRoot.querySelector('.opinion-body');
      if (!selection || selection.isCollapsed || !body || !selection.rangeCount) {
        this.selOpen = false;
        return;
      }
      const range = selection.getRangeAt(0);
      const text = selection.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 3 || !body.contains(range.commonAncestorContainer)) {
        this.selOpen = false;
        return;
      }
      selText = text;
      this.selOpen = true;

      this.$nextTick(() => {
        this.selLocate();
        setTimeout(() => this.selLocate(), 30);
      });
    },
    selLocate() {
      if (!this.selOpen) return;
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const bar = this.$refs.selBar;
      const width = bar.offsetWidth || 300;
      const height = bar.offsetHeight || 36;
      const topbar = stickyBottom();
      const above = rect.top - topbar > height + OCC_GAP * 2;
      const left = Math.min(window.innerWidth - width - OCC_EDGE, Math.max(OCC_EDGE, rect.left + rect.width / 2 - width / 2));
      const top = above ? rect.top - height - OCC_GAP : rect.bottom + OCC_GAP;
      this.selPos = { left: Math.round(left), top: Math.round(top) };
    },
    selCopyCited() {
      const cite = (document.querySelector('.doc-action[data-cite]') || {}).dataset?.cite || '';
      copyText(`“${selText}” ${cite}.`, 'Passage copied with citation');
      this.selOpen = false;
    },
    selCopy() {
      copyText(selText, 'Passage copied');
      this.selOpen = false;
    },

    selCopyLink() {
      const quote = selText.slice(0, 240).trim();
      const url = `${window.location.origin}${window.location.pathname}#q=${encodeURIComponent(quote)}`;
      copyText(url, 'Link to the passage copied');
      this.selOpen = false;
    },
    selFind() {
      const input = this.pageRoot.querySelector('.find__input');
      const query = selText.slice(0, 80);
      this.selOpen = false;
      window.getSelection().removeAllRanges();
      if (input) input.value = query;
      this.openFind();
      this.findRun(query);
    },

    findInput(event) {
      this.findRun(event.target.value.trim());
    },
    findKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) this.findPrev();
        else this.findNext();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeFind();
      }
    },
    findRun(query) {
      this.findExcerpts = true;
      clearFindHits();
      this.find = { query, index: 0, total: 0 };
      this.$refs.findMatches.replaceChildren();
      if (query.length < 2) return;
      if (this.activeTab !== 'opinion') this.enterTab('opinion');
      this.$nextTick(() => {
        const body = this.pageRoot.querySelector('.opinion-body');
        findHits = body ? markMatches(body, query) : [];
        this.find = { query, index: 0, total: findHits.length };
        this.findShow();
      });
    },
    findShow() {
      findHits.forEach((m, i) => m.classList.toggle('find-hit--current', i === this.find.index));
      const hit = findHits[this.find.index];
      this.findRender();
      if (hit) hit.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    },
    findRender() {
      const list = this.$refs.findMatches;
      const focused = list.contains(document.activeElement) ? document.activeElement.dataset.findIndex : null;
      const start = Math.max(0, Math.min(this.find.index - 2, this.find.total - 5));
      const rows = findHits.slice(start, start + 5).map((hit, offset) => {
        const context = hit.closest('p, li, blockquote, h1, h2, h3, h4') || hit.parentElement;
        const range = document.createRange();
        range.selectNodeContents(context);
        range.setEndBefore(hit);
        const position = range.toString().length;
        const text = context.textContent.replace(/\s/g, ' ');
        const before = text.slice(Math.max(0, position - 48), position);
        const after = text.slice(position + hit.textContent.length, position + hit.textContent.length + 80);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'find__match';
        button.dataset.findIndex = String(start + offset);
        button.setAttribute('aria-current', start + offset === this.find.index ? 'true' : 'false');
        const mark = document.createElement('mark');
        mark.textContent = hit.textContent;
        button.append(document.createTextNode(`${position > 48 ? '…' : ''}${before}`), mark, document.createTextNode(`${after}${position + hit.textContent.length + 80 < text.length ? '…' : ''}`));
        button.setAttribute('aria-label', `Match ${start + offset + 1}: ${button.textContent}`);
        return button;
      });
      list.replaceChildren(...rows);
      if (focused !== null && this.findExcerpts) list.querySelector(`[data-find-index="${focused}"]`)?.focus({ preventScroll: true });
    },
    findChoose(event) {
      const button = event.target.closest('[data-find-index]');
      if (!button || !this.$refs.findMatches.contains(button)) return;
      this.find.index = Number(button.dataset.findIndex);
      this.findExcerpts = false;
      this.findShow();
      this.$nextTick(() => {
        const hit = findHits[this.find.index];
        if (!hit) return;
        hit.tabIndex = -1;
        hit.focus({ preventScroll: true });
      });
    },
    findResultKeydown(event) {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(this.$refs.findMatches.querySelectorAll('button'));
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus({ preventScroll: true });
    },
    findNext() {
      if (!this.find.total) return;
      this.find.index = (this.find.index + 1) % this.find.total;
      this.findShow();
    },
    findPrev() {
      if (!this.find.total) return;
      this.find.index = (this.find.index - 1 + this.find.total) % this.find.total;
      this.findShow();
    },

    occLinkFor(event) {
      const link = event.target.closest && event.target.closest('.opinion-body a.cited-case-wrap');
      if (!link || !(link.getAttribute('href') || '').startsWith('#authority-')) return null;
      return link;
    },
    occClearTimers() {
      clearTimeout(this.occOpenTimer);
      clearTimeout(this.occCloseTimer);
      this.occOpenTimer = 0;
      this.occCloseTimer = 0;
    },

    occHold() {
      this.occClearTimers();
    },

    occRelease() {
      this.occClearTimers();
      if (!this.occNav.open) return;
      this.occCloseTimer = setTimeout(() => {
        const card = this.$refs.occCard;
        const active = document.activeElement;
        if (card.contains(active) || active === this.occCurrent()) return;
        this.occClose();
      }, OCC_CLOSE_MS);
    },
    onCitationPointerOver(event) {
      const link = this.occLinkFor(event);
      if (!link || event.pointerType === 'touch' || link.contains(event.relatedTarget)) return;
      this.occClearTimers();
      this.occOpenTimer = setTimeout(() => this.occOpen(link), OCC_OPEN_MS);
    },
    onCitationPointerOut(event) {
      const link = this.occLinkFor(event);
      if (!link || link.contains(event.relatedTarget)) return;
      this.occRelease();
    },
    onCitationFocusIn(event) {
      const link = this.occLinkFor(event);
      if (link && !this.occSuppressFocus) this.occOpen(link);
    },
    onCitationFocusOut(event) {
      if (this.occLinkFor(event)) this.occRelease();
    },

    onCitationKeydown(event) {
      if (event.key !== 'ArrowDown') return;
      const link = this.occLinkFor(event);
      if (!link) return;
      event.preventDefault();
      this.occOpen(link);
      this.$nextTick(() => {
        const controls = this.$refs.occCard.querySelectorAll('a[href], button');
        const first = Array.from(controls).find((el) => el.offsetParent !== null);
        if (first) first.focus();
      });
    },


    occClickOutside(event) {
      if (event.target.closest('a.cited-case-wrap')) return;
      this.occClose();
    },




    flashQuoteInBody(quote) {
      this.enterTab('opinion');
      this.$nextTick(() => {
        const body = this.pageRoot.querySelector('.opinion-body');
        if (!body) return;
        const blocks = body.querySelectorAll('p, blockquote');
        let spans = [];
        for (const allowPrefix of [false, true]) {
          for (const block of blocks) {
            spans = wrapQuoteInBlock(block, quote, allowPrefix);
            if (spans.length) break;
          }
          if (spans.length) break;
        }
        if (!spans.length) return;
        spans[0].scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
        spans.forEach((s) => s.classList.add('quote-flash'));
        setTimeout(() => unwrapSpans(spans), QUOTE_FLASH_MS);
      });
    },

    init() {
      this.pageRoot = this.$root;
      this.handleHash(window.location.hash.slice(1));
      this.$watch('activeTab', () => {
        this.panelSummary = false;
      });
      window.addEventListener('hashchange', () => this.handleHash(window.location.hash.slice(1)));
      this.$root.addEventListener('click', (e) => this.onFootnoteClick(e));
      this.$root.addEventListener('click', (e) => this.onCitationClick(e));
      this.$root.addEventListener('click', (e) => this.onHashLinkClick(e));
      this.$root.addEventListener('keydown', (e) => this.onCitationKeydown(e));
      this.$root.addEventListener('pointerover', (e) => this.onCitationPointerOver(e));
      document.addEventListener('mouseup', () => setTimeout(() => this.onSelection(), 0));

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.findOpen && e.target?.matches('.find-hit')) {
          e.preventDefault();
          e.stopPropagation();
          this.closeFind();
          return;
        }
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
        if (document.querySelector('dialog[open]')) return;
        e.preventDefault();
        this.openFind();
      });
      document.addEventListener('keyup', (e) => {
        if (e.shiftKey || e.key === 'Shift') this.onSelection();
        if (e.key === 'Escape') this.selOpen = false;
      });
      document.addEventListener('selectionchange', () => {
        if (this.selOpen && window.getSelection().isCollapsed) this.selOpen = false;
      });
      this.$root.addEventListener('pointerout', (e) => this.onCitationPointerOut(e));
      this.$root.addEventListener('focusin', (e) => this.onCitationFocusIn(e));
      this.$root.addEventListener('focusout', (e) => this.onCitationFocusOut(e));
      window.addEventListener('scroll', () => this.occFollow(), { passive: true, capture: true });
      window.addEventListener('scroll', () => this.onPageScroll(), { passive: true });
      window.addEventListener('scroll', () => this.findPlace(), { passive: true });
      window.addEventListener('resize', () => this.findPlace());
      window.addEventListener('citator:reader-layout', () => this.findPlace());
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (event) => {
        if (event.matches && findMotion) findMotion.finish();
      });
      this.lastScrollY = window.scrollY;
      window.addEventListener('resize', () => this.occFollow());

      if ('ResizeObserver' in window) new ResizeObserver(() => this.occFollow()).observe(this.$refs.occCard);
    },
  }));
});



function normaliseChar(ch) {
  switch (ch) {
    case '‘': case '’': case '‚': case '′': return "'";
    case '“': case '”': case '„': case '″': return '"';
    case '–': case '—': return '-';
    case ' ': return ' ';
    default: return ch.toLowerCase();
  }
}

function normaliseText(text) {
  const norm = [];
  const map = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i += 1) {
    let ch = text[i];
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = ' ';
      lastSpace = true;
    } else {
      lastSpace = false;
      ch = normaliseChar(ch);
    }
    norm.push(ch);
    map.push(i);
  }
  return { text: norm.join(''), map };
}

function normaliseQuote(quote) {
  return normaliseText(quote).text.trim().replace(/^["'“‘]+|["'”’.,;]+$/g, '').trim();
}



function wrapQuoteInBlock(block, quote, allowPrefix) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement && n.parentElement.closest(NON_PROSE) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes = [];
  let flat = '';
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push({ node, start: flat.length, end: flat.length + node.textContent.length });
    flat += node.textContent;
  }
  const { text: norm, map } = normaliseText(flat);
  const target = normaliseQuote(quote);
  if (!target) return [];
  let idx = norm.indexOf(target);
  let length = target.length;
  if (idx < 0 && allowPrefix && target.length > 60) {
    const head = target.slice(0, 60);
    idx = norm.indexOf(head);
    length = head.length;
  }
  if (idx < 0) return [];
  const start = map[idx];
  const end = map[idx + length - 1] + 1;

  const spans = [];
  for (const tn of textNodes) {
    if (tn.end <= start || tn.start >= end) continue;
    const text = tn.node.textContent;
    const localStart = Math.max(0, start - tn.start);
    const localEnd = Math.min(text.length, end - tn.start);
    const span = document.createElement('span');
    span.textContent = text.slice(localStart, localEnd);
    const fragment = document.createDocumentFragment();
    if (localStart) fragment.appendChild(document.createTextNode(text.slice(0, localStart)));
    fragment.appendChild(span);
    if (localEnd < text.length) fragment.appendChild(document.createTextNode(text.slice(localEnd)));
    tn.node.parentNode.replaceChild(fragment, tn.node);
    spans.push(span);
  }
  return spans;
}

function unwrapSpans(spans) {
  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  }
}

function notify(text, intent = 'positive', message = '') {
  if (window.citatorToast) window.citatorToast({ title: text, message, intent, duration: TOAST_MS });
}

function clearFindHits() {
  const parents = new Set();
  findHits.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parents.add(parent);
  });
  parents.forEach((p) => p.normalize());
  findHits = [];
}

function markMatches(root, query) {
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement && n.parentElement.closest(NON_PROSE) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  const hits = [];
  nodes.forEach((textNode) => {
    const text = textNode.textContent;
    const lower = text.toLowerCase();
    let from = 0;
    let at = lower.indexOf(needle, from);
    if (at < 0) return;
    const fragment = document.createDocumentFragment();
    while (at >= 0) {
      if (at > from) fragment.append(text.slice(from, at));
      const mark = document.createElement('mark');
      mark.className = 'find-hit';
      mark.textContent = text.slice(at, at + needle.length);
      fragment.append(mark);
      hits.push(mark);
      from = at + needle.length;
      at = lower.indexOf(needle, from);
    }
    if (from < text.length) fragment.append(text.slice(from));
    textNode.parentNode.replaceChild(fragment, textNode);
  });
  return hits;
}

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  area.remove();
  return ok;
}

function copyText(text, done) {
  const report = (ok) => (ok ? notify(done) : notify('Copy failed', 'destructive', 'Select the text and copy it instead.'));
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => report(true), () => report(legacyCopy(text)));
  } else {
    report(legacyCopy(text));
  }
}

function stickyBottom() {
  const head = document.querySelector('.case-head');
  if (head) return head.getBoundingClientRect().bottom;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-px')) || 48;
}
