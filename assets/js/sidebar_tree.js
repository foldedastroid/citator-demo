






(function () {
  const KEY = 'citator-tree';

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function write(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      return;
    }
  }

  function subtreeOf(button) {
    return document.getElementById(button.getAttribute('aria-controls'));
  }

  function setOpen(button, open) {
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = button.getAttribute('aria-label') || '';
    button.setAttribute('aria-label', label.replace(/^(Show|Hide)/, open ? 'Hide' : 'Show'));
    const sub = subtreeOf(button);
    if (sub) sub.hidden = !open;
  }

  function tabFor(hash) {
    if (hash === 'authorities' || hash.startsWith('authority-')) return 'authorities';
    if (hash === 'cited-by' || hash.startsWith('citing-')) return 'cited-by';
    if (hash === 'history') return 'history';
    return 'opinion';
  }

  function markLocation() {
    const tab = tabFor(window.location.hash.slice(1));
    document.querySelectorAll('[data-tab-link]').forEach((link) => {
      if (link.dataset.tabLink === tab) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (!document.querySelector('[x-data="searchFilter"]')) return;
    const params = new URLSearchParams(window.location.search);
    let current = params.get('anchors') === '0' ? 'all' : 'anchors';
    const courts = params.get('courts');
    document.querySelectorAll('[data-library-link]').forEach((link) => {
      const href = new URL(link.href, window.location.origin);
      if (courts && href.searchParams.get('courts') === courts) current = link.dataset.libraryLink;
    });
    document.querySelectorAll('[data-library-link]').forEach((link) => {
      const on = link.dataset.libraryLink === current;
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.closest('.tree-row').classList.toggle('is-active', on);
    });
  }

  function applyFilter(root, query) {
    const q = query.trim().toLowerCase();
    let matches = 0;
    root.querySelectorAll('.tree-group').forEach((group) => {
      const button = group.querySelector(':scope > .tree-row [data-tree-toggle]');
      const items = group.querySelectorAll('.tree-item[data-name]');
      let shown = 0;
      items.forEach((item) => {
        const hit = !q || item.dataset.name.includes(q);
        item.hidden = !hit;
        if (hit) shown += 1;
      });
      matches += shown;
      group.hidden = Boolean(q) && shown === 0;
      const sub = button && subtreeOf(button);
      if (sub) sub.hidden = q ? shown === 0 : button.getAttribute('aria-expanded') !== 'true';
    });
    const empty = document.getElementById('tree-no-match');
    if (empty) empty.hidden = !q || matches > 0;
  }

  const RECENT_KEY = 'citator-recent';
  const RECENT_MAX = 6;

  const RECENT_TIERS = ['stop', 'warning', 'caution', 'positive', 'neutral'];



  function readRecent() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(
        (item) =>
          item &&
          typeof item.t === 'string' &&
          /^\/opinion\/\d+\/$/.test(item.u) &&
          RECENT_TIERS.includes(item.s)
      );
    } catch (e) {
      return [];
    }
  }

  function writeRecent(list) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (e) {
      return;
    }
  }

  function recordOpinion() {
    const title = document.querySelector('.opinion-card__title');
    if (!title) return;
    const flag = document.querySelector('.doc-flag');
    const named = flag ? (flag.className.match(/doc-flag--(\w+)/) || [])[1] : '';
    const tier = RECENT_TIERS.includes(named) ? named : 'neutral';
    const entry = { t: title.textContent.trim(), u: window.location.pathname, s: tier };
    const list = readRecent().filter((item) => item.u !== entry.u);
    writeRecent([entry, ...list].slice(0, RECENT_MAX));
  }

  function glyphFor(tier) {
    const holder = document.getElementById('signal-glyphs');
    const source = holder && holder.content.querySelector(`[data-glyph="${tier}"]`);
    if (!source) return document.createElement('span');
    const svg = source.firstElementChild.cloneNode(true);
    svg.setAttribute('class', `tree-signal__mark signal-mark signal-mark--${tier}`);
    const wrap = document.createElement('span');
    wrap.className = 'tree-signal';
    wrap.append(svg);
    return wrap;
  }

  function renderRecent() {
    const section = document.getElementById('tree-recent');
    const list = document.getElementById('tree-recent-list');
    if (!section || !list) return;
    const items = readRecent().filter((item) => item.u !== window.location.pathname);
    list.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'tree-row tree-row--plain';
        link.href = item.u;
        link.title = item.t;
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = item.t;
        link.append(glyphFor(item.s), label);
        li.append(link);
        return li;
      })
    );
    section.hidden = items.length === 0;
  }

  function init() {
    const state = read();
    document.querySelectorAll('[data-tree-toggle]').forEach((button) => {
      const key = button.dataset.treeKey;
      if (button.dataset.treeHere === 'true') return;
      if (Object.prototype.hasOwnProperty.call(state, key)) setOpen(button, state[key]);
    });

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tree-toggle]');
      if (!button) return;
      const open = button.getAttribute('aria-expanded') !== 'true';
      setOpen(button, open);
      const next = read();
      next[button.dataset.treeKey] = open;
      write(next);
    });

    document.addEventListener('click', (event) => {
      document.querySelectorAll('details.list-filter[open]').forEach((menu) => {
        if (!menu.contains(event.target)) menu.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('details.list-filter[open]').forEach((menu) => {
        menu.removeAttribute('open');
        if (menu.contains(document.activeElement)) menu.querySelector('summary').focus();
      });
    });

    document.addEventListener('keydown', (event) => {
      const row = event.target.closest('.tree-row');
      if (!row || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
      const button = row.querySelector('[data-tree-toggle]');
      if (!button) return;
      const open = button.getAttribute('aria-expanded') === 'true';
      if ((event.key === 'ArrowRight') !== open) {
        event.preventDefault();
        button.click();
      }
    });

    const sidebar = document.getElementById('app-sidebar');
    const filter = document.getElementById('tree-filter');
    if (sidebar && filter) {
      filter.addEventListener('input', () => applyFilter(sidebar, filter.value));
      filter.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && filter.value) {
          event.stopPropagation();
          filter.value = '';
          applyFilter(sidebar, '');
        }
      });
    }

    recordOpinion();
    renderRecent();
    document.addEventListener('click', (event) => {
      if (!event.target.closest('[data-recent-clear]')) return;
      writeRecent(readRecent().filter((item) => item.u === window.location.pathname));
      renderRecent();
    });
    markLocation();
    window.addEventListener('hashchange', markLocation);
    window.addEventListener('popstate', markLocation);
    window.addEventListener('citator:location', markLocation);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
