// Owns matching and reversible input expansion; calls the controller’s tab methods for explicit Find actions.
function createReaderFind(lifecycle) {
  // Match nodes and animations belong to this reader, never to another mounted opinion.
  const OCC_EDGE = 8;
  const NON_PROSE = '.cited-case__severity, sup.fnref';
  let findHits = [];
  let findMotion = null;
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

  return {
    find: { query: '', index: 0, total: 0 },
    findOpen: false,
    findExcerpts: true,
    findVisible: false,
    findRevision: 0,
    findRunRevision: 0,
    findBox: null,
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
      if (!open) this.findRunRevision += 1;
      const card = this.$refs.findCard;
      const from = card.getBoundingClientRect().width;
      this.findPlace();
      this.findOpen = open;
      this.findVisible = open;
      const revision = ++this.findRevision;
      if (findMotion) findMotion.cancel();
      findMotion = null;
      lifecycle.nextTick(this, () => {
        if (!lifecycle.active || revision !== this.findRevision) return;
        this.findPlace();
        const target = open ? this.findBox.width : 32;
        const settle = () => {
          if (!lifecycle.active || revision !== this.findRevision) return;
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
      const revision = this.tabRevision;
      lifecycle.nextTick(this, () => {
        if (!lifecycle.active || this.activeTab !== 'opinion' || revision !== this.tabRevision) return;
        this.setFind(true);
        const query = (this.$refs.findInput.value || '').trim();
        if (query && (query !== this.find.query || !this.find.total)) this.findRun(query);
      });
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
    findInput(event) {
      if (!this.findOpen || this.activeTab !== 'opinion') return;
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
      const revision = ++this.findRunRevision;
      this.findExcerpts = true;
      clearFindHits();
      this.find = { query, index: 0, total: 0 };
      this.$refs.findMatches.replaceChildren();
      if (query.length < 2) return;
      if (this.activeTab !== 'opinion') this.enterTab('opinion');
      const tabRevision = this.tabRevision;
      lifecycle.nextTick(this, () => {
        if (!lifecycle.active || revision !== this.findRunRevision || tabRevision !== this.tabRevision || !this.findOpen || this.activeTab !== 'opinion') return;
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
      lifecycle.nextTick(this, () => {
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
    initReaderFind() {
      lifecycle.listen(document, 'keydown', (event) => {
        if (event.key === 'Escape' && this.findOpen && event.target?.matches('.find-hit')) {
          event.preventDefault();
          event.stopPropagation();
          this.closeFind();
          return;
        }
        if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target;
        if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
        if (document.querySelector('dialog[open]')) return;
        event.preventDefault();
        this.openFind();
      });
      lifecycle.listen(window, 'scroll', () => this.findPlace(), { passive: true });
      lifecycle.listen(window, 'resize', () => this.findPlace());
      lifecycle.listen(window, 'citator:reader-layout', () => this.findPlace());
      lifecycle.listen(window.matchMedia('(prefers-reduced-motion: reduce)'), 'change', (event) => {
        if (event.matches && findMotion) findMotion.finish();
      });
      lifecycle.cleanup(() => {
        this.findRevision += 1;
        this.findRunRevision += 1;
        if (findMotion) findMotion.cancel();
        findMotion = null;
        clearFindHits();
      });
    },
  };
}
