








(function () {
  const MAX = 6;

  let opinionsPromise = null;
  function loadOpinions() {
    if (opinionsPromise) return opinionsPromise;
    const node = document.getElementById('opinion-index');
    const src = node && node.dataset.src;
    opinionsPromise = src
      ? fetch(src)
          .then((r) => {
            if (!r.ok) throw new Error('Opinion index unavailable');
            return r.json();
          })
          .then((data) => {
            if (!Array.isArray(data) || data.some((o) => !o || ['t', 'd', 'k', 'u', 's'].some((key) => typeof o[key] !== 'string'))) {
              throw new Error('Invalid opinion index');
            }
            return data;
          })
          .catch((error) => {
            opinionsPromise = null;
            throw error;
          })
      : Promise.resolve([]);
    return opinionsPromise;
  }

  function glyph(name) {
    const holder = document.getElementById('signal-glyphs');
    const source = holder && holder.content.querySelector(`[data-glyph="${name}"]`);
    return source ? source.firstElementChild.cloneNode(true) : document.createElement('span');
  }

  function marked(text, query) {
    const span = document.createElement('span');
    const at = text.toLowerCase().indexOf(query);
    if (!query || at < 0) {
      span.textContent = text;
      return span;
    }
    const mark = document.createElement('mark');
    mark.className = 'suggest__hit';
    mark.textContent = text.slice(at, at + query.length);
    span.append(text.slice(0, at), mark, text.slice(at + query.length));
    return span;
  }

  function rank(o, query) {
    const name = o.t.toLowerCase();
    if (name.startsWith(query)) return 0;
    if (name.split(/[\s.,]+/).some((w) => w.startsWith(query))) return 1;
    if (`${o.t} ${o.d} ${o.k}`.toLowerCase().includes(query)) return 2;
    return -1;
  }

  function init() {
    const root = document.querySelector('[data-suggest]');
    if (!root) return;
    const input = root.querySelector('[role="combobox"]');
    const list = root.querySelector('[role="listbox"]');
    let opinions = [];
    let rows = [];
    let active = 0;
    let composing = false;
    let loadState = 'idle';

    function setOpen(open) {
      list.hidden = !open;
      input.setAttribute('aria-expanded', String(open));
      if (!open) input.removeAttribute('aria-activedescendant');
    }

    function paint(scroll) {
      list.querySelectorAll('[role="option"]').forEach((el, n) => el.setAttribute('aria-selected', String(n === active)));
      const current = document.getElementById(`home-suggest-${active}`);
      if (!current) return;
      input.setAttribute('aria-activedescendant', current.id);
      if (scroll) current.scrollIntoView({ block: 'nearest' });
    }

    function option(n, row) {
      const el = document.createElement('div');
      el.id = `home-suggest-${n}`;
      el.className = 'suggest__option';
      el.setAttribute('role', 'option');
      el.dataset.index = String(n);
      const main = document.createElement('span');
      main.className = 'suggest__main';
      const title = document.createElement('strong');
      title.append(row.title);
      const detail = document.createElement('small');
      detail.textContent = row.detail;
      main.append(title, detail);
      const hint = document.createElement('span');
      hint.className = 'suggest__return';
      hint.setAttribute('aria-hidden', 'true');
      hint.textContent = '↵';
      el.append(glyph(row.glyph), main, hint);
      return el;
    }

    function group(label) {
      const el = document.createElement('div');
      el.className = 'suggest__group';
      el.setAttribute('role', 'presentation');
      el.textContent = label;
      return el;
    }

    function render() {
      const typed = input.value.trim();
      const query = typed.toLowerCase();
      if (!query || composing) {
        setOpen(false);
        return;
      }
      const matches = opinions
        .map((o) => ({ o, r: rank(o, query) }))
        .filter((x) => x.r >= 0)
        .sort((a, b) => a.r - b.r)
        .slice(0, MAX)
        .map(({ o }) => ({ title: marked(o.t, query), detail: o.d, glyph: o.s, run: () => (window.location.href = o.u) }));
      rows = [
        {
          title: `Show results for “${typed}”`,
          detail: 'Filter this list',
          glyph: 'search',
          run: () => {
            setOpen(false);
            const results = document.querySelector('.list-head');
            if (results) results.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
          },
        },
        ...matches,
      ];
      active = Math.min(active, rows.length - 1);
      list.replaceChildren();
      list.append(group('Search'), option(0, rows[0]));
      if (matches.length) {
        list.append(group('Opinions'));
        matches.forEach((row, i) => list.append(option(i + 1, row)));
      } else {
        const empty = document.createElement('p');
        empty.className = 'suggest__empty';
        empty.setAttribute('role', 'status');
        empty.textContent = loadState === 'loading' ? 'Loading suggestions…'
          : loadState === 'error' ? 'Suggestions unavailable. You can still filter this list.'
          : 'No opinion names or citations match';
        list.append(empty);
      }
      setOpen(true);
      paint(false);
    }

    function choose(n) {
      const row = rows[n];
      if (row) row.run();
    }

    function load() {
      if (loadState === 'loading' || loadState === 'ready') return;
      loadState = 'loading';
      input.setAttribute('aria-busy', 'true');
      loadOpinions()
        .then((data) => { opinions = data; loadState = 'ready'; })
        .catch(() => { loadState = 'error'; })
        .finally(() => {
          input.setAttribute('aria-busy', 'false');
          if (document.activeElement === input && input.value.trim()) render();
        });
    }
    input.addEventListener('focus', () => {
      load();
      render();
    });
    input.addEventListener('input', () => {
      load();
      active = 0;
      render();
    });
    input.addEventListener('compositionstart', () => {
      composing = true;
      setOpen(false);
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      active = 0;
      render();
    });
    input.addEventListener('keydown', (event) => {
      const open = !list.hidden;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!open) {
          active = 0;
          render();
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        active = (active + step + rows.length) % rows.length;
        paint(true);
      } else if (event.key === 'Enter' && open) {
        event.preventDefault();
        choose(active);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      } else if (event.key === 'Tab') {
        setOpen(false);
      }
    });
    input.addEventListener('blur', () => setOpen(false));

    list.addEventListener('pointerdown', (event) => event.preventDefault());
    list.addEventListener('click', (event) => {
      const el = event.target.closest('[role="option"]');
      if (el) choose(Number(el.dataset.index));
    });
    list.addEventListener('mousemove', (event) => {
      const el = event.target.closest('[role="option"]');
      if (el && Number(el.dataset.index) !== active) {
        active = Number(el.dataset.index);
        paint(false);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
