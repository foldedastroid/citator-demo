(function () {
  const ROW = 24;

  const MARKER_SIZE = 12;
  const FADE = 0.2;
  const MIN_OPACITY = 0.45;
  const LABEL_TAU = 200;
  const MARKER_TAU = 70;
  const ROMAN = /^[IVXLC]+\.?$/;

  const TICKS_FROM = 38;
  const LABELS_FROM = 40;

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function init() {
    const rail = document.querySelector('[data-doc-rail]');
    const page = rail && rail.closest('.opinion-page, .doc-page');
    if (!page) return;
    const field = rail.querySelector('.doc-rail__field');
    const list = rail.querySelector('.doc-rail__list');
    const thumb = rail.querySelector('.doc-rail__thumb');
    const track = rail.querySelector('.doc-rail__track');
    let segments = [];
    const body = page.querySelector('.doc-layout__body');
    const layout = page.querySelector('.doc-layout');
    if (!field || !list || !thumb || !track || !layout) return;
    const hover = document.createElement('span');
    hover.className = 'doc-rail__hover';
    hover.setAttribute('aria-hidden', 'true');
    field.insertBefore(hover, list);
    let hoveredPart = null;
    let focusedPart = null;

    function showPreview() {
      const part = hoveredPart || focusedPart;
      const show = part && layout.dataset.rail === 'labels' && part.level === 1;
      hover.classList.toggle('is-visible', Boolean(show));
      if (show) hover.style.transform = `translateY(${part.at.toFixed(1)}px)`;
    }
    function previewPart(event) {
      const link = event.target.closest('.doc-rail__link');
      return link ? parts[Number(link.dataset.index)] : null;
    }
    list.addEventListener('pointerover', (event) => {
      if (event.pointerType === 'touch') return;
      hoveredPart = previewPart(event);
      showPreview();
    });
    list.addEventListener('pointerleave', () => {
      hoveredPart = null;
      showPreview();
    });
    list.addEventListener('focusin', (event) => {
      focusedPart = previewPart(event);
      showPreview();
    });
    list.addEventListener('focusout', (event) => {
      const next = event.relatedTarget?.closest?.('.doc-rail__link');
      focusedPart = next ? parts[Number(next.dataset.index)] : null;
      showPreview();
    });
    const column = layout.parentElement;
    let parts = [];
    let mains = [];
    let height = 0;
    let maxScroll = 1;
    let offset = 0;
    let labelNow = 0;
    let labelGoal = 0;
    let markerNow = 0;
    let markerGoal = 0;
    let frame = 0;
    let last = 0;
    let layoutFrame = 0;
    let scrubbing = null;
    let needsMeasure = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function stickyOffset() {
      const head = page.querySelector('.case-head');
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-px')) || 56;
      return bar + (head ? head.offsetHeight : 0) + 16;
    }

    function visiblePanel() {
      return Array.from(page.querySelectorAll('[role="tabpanel"]')).find((p) => p.offsetParent !== null) || null;
    }

    function textOf(el) {
      return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function short(text) {
      return text.length > 48 ? `${text.slice(0, 46).trim()}…` : text;
    }

    function collect() {
      const found = [];
      const add = (el, label, level, top = false, panel = false) => {
        if (el && label) found.push({ el, label: short(label), level, top, panel });
      };
      if (!page.classList.contains('opinion-page')) {
        add(body, 'Top', 1, true);
        body.querySelectorAll('article > section[id]').forEach((el) => {
          const heading = el.querySelector('h2');
          if (heading) add(el, textOf(heading), 1);
        });
        return found;
      }
      add(page.querySelector('.opinion-card'), 'Top', 1, true);
      add(page.querySelector('#treatment-summary'), 'Status', 1);
      const panel = visiblePanel();
      if (!panel) return found;
      const tab = document.getElementById(panel.getAttribute('aria-labelledby') || '');
      let name = '';
      if (tab) {
        const clone = tab.cloneNode(true);
        clone.querySelectorAll('.tab-count').forEach((n) => n.remove());
        name = textOf(clone);
      }
      add(panel, name || 'Text', 1, false, true);
      if (panel.dataset.tab === 'opinion') {
        let counsel = false;
        let judges = false;
        let notes = 0;
        const sections = panel.querySelectorAll('.opinion-body section').length;
        panel
          .querySelectorAll('.opinion-body section > h2, .opinion-body .opinion-attorneys, .opinion-body .opinion-judges, .opinion-body h3.opinion-heading, .opinion-body .opinion-footnotes')
          .forEach((el) => {
            if (el.matches('section > h2')) {
              const text = textOf(el);
              add(el.parentElement, ROMAN.test(text) ? `Part ${text.replace('.', '')}` : text, sections > 1 ? 1 : 2);
            } else if (el.matches('.opinion-attorneys')) {
              if (!counsel) add(el, 'Counsel', 1);
              counsel = true;
            } else if (el.matches('.opinion-judges')) {
              if (!judges) add(el, 'Judges', 1);
              judges = true;
            } else if (el.matches('.opinion-footnotes')) {
              add(el, 'Footnotes', notes ? 2 : 1);
              notes += 1;
            } else if (!el.classList.contains('opinion-heading--notes')) {
              add(el, textOf(el), 2);
            }
          });
      } else {
        panel.querySelectorAll('.court-group-head').forEach((el) => {
          if (el.offsetParent !== null) add(el, textOf(el), 1);
        });
      }
      return found;
    }

    function along(scroll) {
      const half = ROW / 2;
      return half + (scroll / maxScroll) * Math.max(0, height - ROW);
    }

    function docTop(el) {
      return el.getBoundingClientRect().top + window.scrollY;
    }

    function render() {
      const fresh = collect();
      fresh.forEach((p) => {
        p.y = p.top ? 0 : docTop(p.el);
      });
      fresh.sort((a, b) => a.y - b.y);

      const panelAt = fresh.findIndex((p) => p.panel);
      const after = fresh[panelAt + 1];
      if (panelAt > -1 && after && after.level === 1 && after.y - fresh[panelAt].y < 96) fresh.splice(panelAt, 1);
      // Layout measurements must not replace focused links or restart a hover transition.
      if (fresh.length === parts.length && fresh.every((p, i) =>
        p.el === parts[i].el && p.label === parts[i].label && p.level === parts[i].level)) {
        place();
        return;
      }
      hoveredPart = null;
      focusedPart = null;
      showPreview();
      list.replaceChildren();
      parts = fresh.map((part, n) => {
        const item = document.createElement('li');
        item.className = `doc-rail__item doc-rail__item--l${part.level}`;
        const link = document.createElement('a');
        link.className = 'doc-rail__link';
        if (!part.el.id && !part.top) part.el.id = `part-${n + 1}`;
        link.href = part.top ? '#top' : `#${part.el.id}`;
        link.dataset.index = String(n);
        const tick = document.createElement('span');
        tick.className = 'doc-rail__tick';
        tick.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = 'doc-rail__label';
        label.textContent = part.label;
        link.append(tick, label);
        item.append(link);
        list.append(item);
        return { ...part, item, link };
      });
      mains = parts.filter((p) => p.level === 1);
      place();
    }

    function place() {
      height = field.clientHeight;
      offset = stickyOffset();
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      parts.forEach((p) => {
        p.y = p.top ? 0 : docTop(p.el);
        p.scroll = p.top ? 0 : Math.min(maxScroll, Math.max(0, p.y - offset));
        p.at = along(p.scroll);
      });
      const half = ROW / 2;
      let floor = -Infinity;
      mains.forEach((p) => {
        p.at = Math.max(p.at, half, floor + ROW);
        floor = p.at;
      });
      let ceiling = height - half;
      for (let i = mains.length - 1; i >= 0; i -= 1) {
        mains[i].at = Math.max(half, Math.min(mains[i].at, ceiling));
        ceiling = mains[i].at - ROW;
      }
      parts.forEach((p) => {
        p.item.style.transform = `translateY(${p.at.toFixed(1)}px)`;
        const label = p.link.lastChild;
        if (label.scrollWidth > label.clientWidth + 1) p.link.title = p.label;
        else p.link.removeAttribute('title');
      });
      showPreview();
      cut();
      measure();
      markerNow = markerGoal;
      labelNow = labelGoal;
      paint();
    }

    function cut() {
      const spans = [[0, height]];
      track.replaceChildren();
      segments = spans.map(([top, bottom]) => {
        const seg = document.createElement('span');
        seg.className = 'doc-rail__seg';
        seg.style.top = `${top.toFixed(1)}px`;
        seg.style.height = `${(bottom - top).toFixed(1)}px`;
        const fill = document.createElement('span');
        fill.className = 'doc-rail__fill';
        seg.append(fill);
        track.append(seg);
        return { top, h: bottom - top, fill };
      });
    }

    function stops() {
      return [{ scroll: 0, at: ROW / 2 }, ...mains.map((p) => ({ scroll: p.scroll, at: p.at })), { scroll: maxScroll, at: height - ROW / 2 }].filter(
        (s, i, all) => i === 0 || (s.scroll >= all[i - 1].scroll && s.at >= all[i - 1].at)
      );
    }

    function markerAt(y) {
      const list = stops();
      for (let i = list.length - 1; i > 0; i -= 1) {
        const a = list[i - 1];
        const b = list[i];
        if (y >= a.scroll) {
          const t = b.scroll > a.scroll ? (y - a.scroll) / (b.scroll - a.scroll) : 1;
          return a.at + Math.min(1, Math.max(0, t)) * (b.at - a.at);
        }
      }
      return ROW / 2;
    }

    function scrollAt(at) {
      const list = stops();
      for (let i = list.length - 1; i > 0; i -= 1) {
        const a = list[i - 1];
        const b = list[i];
        if (at >= a.at) {
          const t = b.at > a.at ? (at - a.at) / (b.at - a.at) : 1;
          return a.scroll + Math.min(1, Math.max(0, t)) * (b.scroll - a.scroll);
        }
      }
      return 0;
    }

    function measure() {
      const y = Math.min(maxScroll, Math.max(0, window.scrollY));
      markerGoal = markerAt(y);
      const reached = (p) => p.scroll <= y + 4;
      let k = 0;
      mains.forEach((p, i) => {
        if (reached(p)) k = i;
      });
      const here = mains[k];
      const next = mains[k + 1];
      let frac = 0;
      if (here && next && next.scroll > here.scroll) frac = Math.min(1, Math.max(0, (y - here.scroll) / (next.scroll - here.scroll)));
      labelGoal = k + frac * 0.999;
      let current = 0;
      parts.forEach((p, i) => {
        if (reached(p)) current = i;
      });
      parts.forEach((p, i) => {
        const on = i === current;
        p.item.classList.toggle('is-active', on);
        p.item.classList.toggle('is-reached', reached(p));
        if (on) p.link.setAttribute('aria-current', 'location');
        else p.link.removeAttribute('aria-current');
      });
    }

    function paint() {

      const from = Math.max(0, Math.min(height - MARKER_SIZE, markerNow - MARKER_SIZE / 2));
      thumb.style.transform = `translate3d(0, ${from.toFixed(1)}px, 0)`;
      thumb.style.height = `${MARKER_SIZE}px`;
      thumb.style.opacity = '1';
      const progress = window.scrollY >= maxScroll - 1 ? height : markerNow;
      segments.forEach((seg) => {
        const f = Math.min(1, Math.max(0, (progress - seg.top) / Math.max(1, seg.h)));
        seg.fill.style.transform = `scaleY(${f.toFixed(4)})`;
      });
      mains.forEach((p, i) => {
        const d = Math.abs(i - labelNow);
        p.link.style.setProperty('--near', Math.max(0, 1 - Math.min(d, 1)).toFixed(3));
        p.link.style.setProperty('--fade', Math.max(MIN_OPACITY, 1 - d * FADE).toFixed(3));
      });
    }

    function step(now) {
      if (needsMeasure) {
        needsMeasure = false;
        measure();
      }
      const dt = Math.min(now - last, 50);
      last = now;
      const still = reducedMotion();
      const kl = still ? 1 : 1 - Math.exp(-dt / LABEL_TAU);
      const km = still ? 1 : 1 - Math.exp(-dt / MARKER_TAU);
      labelNow += (labelGoal - labelNow) * kl;
      markerNow += (markerGoal - markerNow) * km;
      const settled = Math.abs(labelGoal - labelNow) < 0.002 && Math.abs(markerGoal - markerNow) < 0.3;
      if (settled) {
        labelNow = labelGoal;
        markerNow = markerGoal;
      }
      paint();
      frame = settled ? 0 : requestAnimationFrame(step);
    }

    function wake() {
      if (field.offsetParent === null || !parts.length) return;
      needsMeasure = true;
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    }

    function fit() {
      const head = page.querySelector('.case-head');
      if (head) document.documentElement.style.setProperty('--case-head-h', `${head.offsetHeight}px`);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const width = column.clientWidth / rem;
      const reading = !page.classList.contains('opinion-page') || visiblePanel()?.dataset.tab === 'opinion';
      const mode = reading ? (width >= LABELS_FROM ? 'labels' : width >= TICKS_FROM ? 'ticks' : '') : '';
      if ((layout.dataset.rail || '') === mode) return;
      if (mode) layout.dataset.rail = mode;
      else delete layout.dataset.rail;
      window.dispatchEvent(new Event('citator:reader-layout'));
    }

    function relayout() {
      fit();
      cancelAnimationFrame(layoutFrame);
      layoutFrame = requestAnimationFrame(() => {
        if (field.offsetParent === null) return;
        render();
      });
    }

    function go(part) {
      const behavior = reducedMotion() ? 'instant' : 'smooth';
      window.scrollTo({ top: part.top ? 0 : Math.max(0, part.y - offset), behavior });
      if (!part.top && !part.el.id.startsWith('part-')) history.replaceState(null, '', `#${part.el.id}`);
    }

    list.addEventListener('click', (event) => {
      const link = event.target.closest('.doc-rail__link');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      const part = parts[Number(link.dataset.index)];
      if (part) go(part);
    });

    list.addEventListener('keydown', (event) => {
      const link = event.target.closest('.doc-rail__link');
      if (!link) return;
      const links = parts.map((p) => p.link);
      const n = links.indexOf(link);
      let to = null;
      if (event.key === 'ArrowDown') to = Math.min(links.length - 1, n + 1);
      else if (event.key === 'ArrowUp') to = Math.max(0, n - 1);
      else if (event.key === 'Home') to = 0;
      else if (event.key === 'End') to = links.length - 1;
      if (to === null) return;
      event.preventDefault();
      links[to].focus();
    });

    let grab = 0;
    let pending = null;
    let swallowClick = false;
    function scrubTo(clientY) {
      const rect = field.getBoundingClientRect();
      const at = Math.min(height, Math.max(0, clientY - rect.top - grab));
      window.scrollTo({ top: scrollAt(at), behavior: 'instant' });
      measure();
      markerNow = markerGoal;
      labelNow = labelGoal;
      paint();
    }
    function startScrub(event, offset) {
      scrubbing = event.pointerId;
      grab = offset;
      field.setPointerCapture(event.pointerId);
      rail.classList.add('is-scrubbing');
    }
    field.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const rect = field.getBoundingClientRect();
      if (event.target.closest('.doc-rail__thumb')) {
        event.preventDefault();
        startScrub(event, event.clientY - rect.top - markerNow);
        return;
      }
      if (event.target.closest('.doc-rail__link')) {
        pending = { id: event.pointerId, y: event.clientY };
        return;
      }
      event.preventDefault();
      startScrub(event, 0);
      scrubTo(event.clientY);
    });
    field.addEventListener('pointermove', (event) => {
      if (pending && pending.id === event.pointerId && Math.abs(event.clientY - pending.y) > 4) {
        const rect = field.getBoundingClientRect();
        startScrub(event, pending.y - rect.top - markerNow);
        pending = null;
        swallowClick = true;
      }
      if (scrubbing === event.pointerId) scrubTo(event.clientY);
    });
    const endScrub = (event) => {
      pending = null;
      if (scrubbing !== event.pointerId) return;
      scrubbing = null;
      grab = 0;
      rail.classList.remove('is-scrubbing');
    };
    field.addEventListener('pointerup', endScrub);
    field.addEventListener('pointercancel', endScrub);
    field.addEventListener('lostpointercapture', endScrub);

    field.addEventListener(
      'click',
      (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );

    const placeKey = page.classList.contains('opinion-page') ? `citator-place:${window.location.pathname}` : '';
    const PLACE_DAYS = 30;
    let placeTimer = 0;
    function keepPlace() {
      if (!placeKey || visiblePanel()?.dataset.tab !== 'opinion') return;
      clearTimeout(placeTimer);
      placeTimer = setTimeout(() => {
        if (visiblePanel()?.dataset.tab !== 'opinion') return;
        const current = parts.filter((p) => p.level === 1 && p.item.classList.contains('is-active'))[0] || mains.filter((p) => p.scroll <= window.scrollY + 4).pop();
        try {
          localStorage.setItem(placeKey, JSON.stringify({ y: Math.round(window.scrollY), label: current ? current.label : '', t: Date.now() }));
        } catch (e) {

        }
      }, 400);
    }
    function offerPlace() {
      if (!placeKey || window.location.hash || window.scrollY > 100 || !window.citatorToast) return;
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(placeKey) || 'null');
      } catch (e) {
        saved = null;
      }
      if (!saved || saved.y < 600 || Date.now() - saved.t > PLACE_DAYS * 864e5) return;
      if (saved.y > document.documentElement.scrollHeight - window.innerHeight + 2) return;
      window.citatorToast({
        title: 'Continue where you left off',
        message: saved.label ? `At ${saved.label}` : '',
        intent: 'neutral',
        duration: 8000,
        action: { label: 'Continue', run: () => window.scrollTo({ top: saved.y, behavior: reducedMotion() ? 'instant' : 'smooth' }) },
      });
    }

    window.addEventListener('scroll', wake, { passive: true });
    motion.addEventListener('change', wake);
    window.addEventListener('scroll', keepPlace, { passive: true });
    setTimeout(offerPlace, 600);
    window.addEventListener('resize', relayout);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(relayout);
      if (body) observer.observe(body);
      observer.observe(field);
      observer.observe(column);
      const head = page.querySelector('.case-head');
      if (head) observer.observe(head);
    }

    const watch = new MutationObserver(relayout);
    page.querySelectorAll('[role="tabpanel"], [data-row-id]').forEach((el) => watch.observe(el, { attributes: true, attributeFilter: ['style', 'hidden', 'data-group-first'] }));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    relayout();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
