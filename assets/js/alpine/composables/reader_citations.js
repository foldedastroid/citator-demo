// Owns citation identity, treatment evidence and occurrence stepping; the page scheduler follows its overlay.
function createReaderCitations(lifecycle) {
  const OCC_WIDTH = 272;
  const OCC_GAP = 7;
  const OCC_EDGE = 8;
  const OCC_OPEN_MS = 180;
  const OCC_CLOSE_MS = 160;
  const TIERS = ['stop', 'warning', 'caution', 'positive', 'neutral'];
  const EMPTY_ROW = { rationale: '', quote: '', hasAnalysis: false, item: 0, items: 0 };
  let occItems = [];


  return {
    occPinned: false,
    occNav: { key: '', open: false, n: 0, name: '', url: '', index: 0, total: 0, ...EMPTY_ROW },
    occPos: { left: 0, top: 0, width: OCC_WIDTH, below: false, originX: 0 },
    occOpenTimer: 0,
    occCloseTimer: 0,
    occSuppressFocus: false,
    onCitationClick(event) {
      const link = this.occLinkFor(event);
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      this.occOpen(link, true);
      if (event.detail === 0) lifecycle.nextTick(this, () => this.$refs.occCard.querySelector('button').focus({ preventScroll: true }));
    },
    get occNavOpen() {
      return this.occNav.open;
    },
    get occNavClass() {
      return this.occNav.open ? (this.occPinned ? 'is-open is-pinned' : 'is-open') : '';
    },
    get occNavStyle() {
      if (this.occPinned) return {};
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
      if (this.occNav.total === 1) return 'Only occurrence';
      return `Occurrence ${this.occNav.index + 1} of ${this.occNav.total}`;
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
    get occNavOnlyCited() {
      return this.occNav.open && this.occNav.n > 0 && !this.occNav.hasAnalysis;
    },
    get occNavUnknown() {
      return this.occNav.open && this.occNav.n === 0;
    },
    get occNavHasRow() {
      return this.occNav.n > 0;
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
      lifecycle.nextTick(this, () => this.occLocate());
    },
    occItemNext() {
      this.occItemStep(1);
    },
    occItemPrev() {
      this.occItemStep(-1);
    },
    occMentions(n, key = this.occNav.key) {
      if (n) return Array.from(this.pageRoot.querySelectorAll(`.opinion-body a.cited-case-wrap[data-group="${n}"]`));
      return Array.from(this.pageRoot.querySelectorAll('.opinion-body .cited-case-wrap a.cited-case[href]'))
        .filter(link => `url:${link.getAttribute('href')}` === key);
    },
    occOpen(link, pinned = false) {
      if (this.occPinned && !pinned) return;
      this.occHold();
      const n = parseInt(link.dataset.group, 10) || 0;
      const key = n ? `group:${n}` : `url:${link.getAttribute('href')}`;
      const mentions = this.occMentions(n, key);
      if (!mentions.length) return;
      const index = Math.max(0, mentions.indexOf(link));
      this.occPinned = pinned;
      if (this.occNav.open && this.occNav.key === key && this.occNav.index === index) {
        if (pinned) lifecycle.nextTick(this, () => this.occShow());
        return;
      }
      if (!n) {
        this.$refs.occPills.replaceChildren();
        this.$refs.occPillsPlain.replaceChildren();
        occItems = [];
      }
      this.occNav = {
        key,
        open: true,
        n,
        name: link.dataset.name || link.getAttribute('title') || link.textContent.trim(),
        url: link.dataset.url || (n ? '' : link.getAttribute('href')),
        index,
        total: mentions.length,
        ...(n ? this.occRowLead(n) : EMPTY_ROW),
      };
      lifecycle.nextTick(this, () => pinned ? this.occShow() : this.occLocate());
    },
    occShow() {
      highlightElement(this.occCurrent(), 'mention-flash');
      lifecycle.nextTick(this, () => this.occLocate());
    },
    occCurrent() {
      return this.occMentions(this.occNav.n)[this.occNav.index] || null;
    },
    occLocate() {
      if (!this.occNav.open || this.occPinned) return;
      const mention = this.occCurrent();
      const card = this.$refs.occCard;
      if (!mention || !card) return;
      const rect = mention.getBoundingClientRect();
      const width = Math.min(OCC_WIDTH, window.innerWidth - OCC_EDGE * 2);
      const height = card.offsetHeight || 180;
      const topbar = readerHeaderBottom(this.pageRoot);
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
      this.occClose();
      this.enterTab('authorities', hash);
      this.handleHash(hash);
      lifecycle.nextTick(this, () => {
        const row = document.getElementById(hash);
        if (!row) return;
        row.tabIndex = -1;
        row.focus({ preventScroll: true });
      });
    },
    occClose() {
      this.occClearTimers();
      this.occPinned = false;
      this.occNav = { key: '', open: false, n: 0, name: '', url: '', index: 0, total: 0, ...EMPTY_ROW };
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
    occLinkFor(event) {
      const link = event.target.closest?.('.opinion-body a.cited-case-wrap, .opinion-body .cited-case-wrap a.cited-case[href]');
      if (!link) return null;
      const href = link.getAttribute('href') || '';
      return href.startsWith('#authority-') || /^\/opinion\/\d+\/$/.test(href) ? link : null;
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
      if (!this.occNav.open || this.occPinned) return;
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
      this.occOpen(link, true);
      lifecycle.nextTick(this, () => {
        const controls = this.$refs.occCard.querySelectorAll('a[href], button');
        const first = Array.from(controls).find((el) => el.offsetParent !== null);
        if (first) first.focus();
      });
    },
    occClickOutside(event) {
      if (this.occLinkFor(event)) return;
      this.occClose();
    },
    initReaderCitations() {
      lifecycle.listen(this.pageRoot, 'click', (event) => this.onCitationClick(event));
      lifecycle.listen(this.pageRoot, 'keydown', (event) => this.onCitationKeydown(event));
      lifecycle.listen(this.pageRoot, 'pointerover', (event) => this.onCitationPointerOver(event));
      lifecycle.listen(this.pageRoot, 'pointerout', (event) => this.onCitationPointerOut(event));
      lifecycle.listen(this.pageRoot, 'focusin', (event) => this.onCitationFocusIn(event));
      lifecycle.listen(this.pageRoot, 'focusout', (event) => this.onCitationFocusOut(event));
      lifecycle.cleanup(() => this.occClose());
    },
  };
}
