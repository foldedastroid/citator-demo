// Owns the selected passage, clipboard actions and temporary passage highlights; Find is delegated to its feature.
function createReaderSelection(lifecycle) {
  const OCC_GAP = 7;
  const OCC_EDGE = 8;
  const NON_PROSE = '.cited-case__severity, sup.fnref';
  const QUOTE_FLASH_MS = 3500;
  const TOAST_MS = 4000;
  let selText = '';
  let selectionTimer = 0;
  let positionTimer = 0;
  const quoteFlashes = new Map();
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

  return {
    selOpen: false,
    selPos: { left: 0, top: 0 },
    readQuote() {
      this.flashQuoteInBody(this.$el.dataset.quote || '');
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

      lifecycle.nextTick(this, () => {
        if (!lifecycle.active) return;
        this.selLocate();
        clearTimeout(positionTimer);
        positionTimer = setTimeout(() => this.selLocate(), 30);
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
      const topbar = readerHeaderBottom(this.pageRoot);
      const above = rect.top - topbar > height + OCC_GAP * 2;
      const left = Math.min(window.innerWidth - width - OCC_EDGE, Math.max(OCC_EDGE, rect.left + rect.width / 2 - width / 2));
      const top = above ? rect.top - height - OCC_GAP : rect.bottom + OCC_GAP;
      this.selPos = { left: Math.round(left), top: Math.round(top) };
    },
    selCopyCited() {
      const cite = (this.pageRoot.querySelector('.doc-action[data-cite]') || {}).dataset?.cite || '';
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
    flashQuoteInBody(quote) {
      this.enterTab('opinion');
      lifecycle.nextTick(this, () => {
        if (!lifecycle.active) return;
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
        const timer = setTimeout(() => {
          unwrapSpans(spans);
          quoteFlashes.delete(timer);
        }, QUOTE_FLASH_MS);
        quoteFlashes.set(timer, spans);
      });
    },
    initReaderSelection() {
      lifecycle.listen(document, 'mouseup', () => {
        clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => this.onSelection(), 0);
      });
      lifecycle.listen(document, 'keyup', (event) => {
        if (event.shiftKey || event.key === 'Shift') this.onSelection();
        if (event.key === 'Escape') this.selOpen = false;
      });
      lifecycle.listen(document, 'selectionchange', () => {
        if (this.selOpen && window.getSelection().isCollapsed) this.selOpen = false;
      });
      lifecycle.cleanup(() => {
        clearTimeout(selectionTimer);
        clearTimeout(positionTimer);
        for (const [timer, spans] of quoteFlashes) {
          clearTimeout(timer);
          unwrapSpans(spans);
        }
        quoteFlashes.clear();
        selText = '';
        this.selOpen = false;
      });
    },
  };
}
