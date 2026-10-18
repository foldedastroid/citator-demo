// Owns Why and footnote dialogs; citation dismissal and overlay scheduling stay on the shared controller.
function createReaderPopovers(lifecycle) {
  const OCC_WIDTH = 272;
  const OCC_GAP = 7;
  const OCC_EDGE = 8;
  const FN_WIDTH = 280;
  let fnAnchor = null;


  return {
    whyOpen: false,
    whyPos: { left: 0, top: 0, width: OCC_WIDTH },
    fn: { open: false, label: '', href: '#' },
    fnPos: { left: 0, top: 0, width: FN_WIDTH },
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
      lifecycle.nextTick(this, () => {
        if (!lifecycle.active) return;
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
      lifecycle.nextTick(this, () => {
        if (!lifecycle.active) return;
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
    initReaderPopovers() {
      lifecycle.listen(this.pageRoot, 'click', (event) => this.onFootnoteClick(event));
      lifecycle.cleanup(() => {
        this.fnClose();
        this.whyOpen = false;
        fnAnchor = null;
      });
    },
  };
}
