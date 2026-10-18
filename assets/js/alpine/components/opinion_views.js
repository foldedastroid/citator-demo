











const CHART_OPEN_KEY = 'citator-cite-chart';
const CHART_AXIS_KEY = 'citator-cite-chart-axis';
const CHART_AXES = ['court', 'year'];
const CHART_PERIOD_KEY = 'citator-cite-chart-period';
const CHART_PERIODS = ['auto', 'year', 'decade', 'century'];
const HISTORY_VIEW_KEY = 'citator-history-view';
const HISTORY_VIEWS = ['courts', 'timeline'];

function viewStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function viewStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {

  }
}

function narrowMarks() {
  return {
    narrowing: { tier: '', court: '', year: '' },

    isCurrentNarrow(el) {
      const d = el.dataset;
      const named = { tier: d.narrow, court: d.narrowCourt, year: d.narrowYear };
      const facet = 'narrowFacet' in d;
      return Object.keys(named).every((k) =>
        named[k] === undefined ? facet || !this.narrowing[k] : named[k] === this.narrowing[k]
      );
    },
    get narrowItemClass() {
      return this.isCurrentNarrow(this.$el) ? 'is-current' : '';
    },
    get narrowItemCurrent() {
      return this.isCurrentNarrow(this.$el) ? 'true' : false;
    },

    listenNarrow() {
      const list = this.$root.dataset.list;
      window.addEventListener('citator-narrow', (event) => {
        if (event.detail.list !== list) return;
        this.narrowing = { tier: event.detail.tier, court: event.detail.court, year: event.detail.year };
      });
    },
  };
}

function withNarrowMarks(component) {
  return Object.defineProperties(component, Object.getOwnPropertyDescriptors(narrowMarks()));
}

function layoutHistoryTimeline(root) {
  const timeline = root.querySelector('.history-view[data-history-view="timeline"]');
  const track = timeline && timeline.querySelector('.tl__track');
  if (!track || !timeline.offsetWidth) return;
  const row = track.querySelector('.tl__row');
  if (row && getComputedStyle(row).display !== 'none') return;
  const bounds = timeline.getBoundingClientRect();
  const items = Array.from(track.querySelectorAll('.tl__item'));
  const nodeBounds = items.map((item) => item.querySelector('.tl__node').getBoundingClientRect());
  const placed = [];
  const overlaps = (a, b, gap = 4) =>
    a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
  items.forEach((item, index) => {
    const at = item.getBoundingClientRect();
    const label = item.querySelector('.tl__label');
    if (label) {
      label.hidden = false;
      label.classList.remove('tl__label--flip');
      const labelWidth = label.getBoundingClientRect().width;
      if (at.left + labelWidth + 28 > bounds.right - 8) label.classList.add('tl__label--flip');
      const rect = label.getBoundingClientRect();
      const blocked = rect.left < bounds.left + 8 || rect.right > bounds.right - 8 ||
        nodeBounds.some((node, other) => other !== index && overlaps(rect, node, 8)) ||
        placed.some((other) => overlaps(rect, other));
      label.hidden = blocked;
      if (!blocked) placed.push(rect);
    }
    const card = item.querySelector('.tl__card');
    if (!card) return;
    const left = Math.max(bounds.left + 8, Math.min(at.left - card.offsetWidth / 2, bounds.right - card.offsetWidth - 8));
    card.style.left = `${left - at.left}px`;
    card.style.right = 'auto';
    card.style.transform = 'none';
    card.classList.toggle('tl__card--above', at.top + card.offsetHeight + 24 > window.innerHeight && at.top > card.offsetHeight + 24);
  });
}

function observeHistoryTimeline(root) {
  let frame = 0;
  let disposed = false;
  const queue = () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      layoutHistoryTimeline(root);
    });
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null;
  if (observer) observer.observe(root);
  root.addEventListener('focusin', queue);
  root.addEventListener('pointerover', queue);
  window.addEventListener('resize', queue);
  if (document.fonts) document.fonts.ready.then(queue);
  queue();
  return {
    refresh: queue,
    stop() {
      disposed = true;
      if (observer) observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener('focusin', queue);
      root.removeEventListener('pointerover', queue);
      window.removeEventListener('resize', queue);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('narrowPanel', () =>
    withNarrowMarks({
      init() {
        this.listenNarrow();
      },
    })
  );

  Alpine.data('citingChart', () =>
    withNarrowMarks({
      chartOpen: true,
      axis: 'court',
      periodMode: 'auto',
      canScrollBack: false,
      canScrollForward: false,
      chartRefresh: null,
      chartStop: null,

      get chartExpanded() {
        return this.chartOpen ? 'true' : 'false';
      },
      get chartBodyClass() {
        return this.chartOpen ? '' : 'is-collapsed';
      },
      toggleChart() {
        this.chartOpen = !this.chartOpen;
        viewStore(CHART_OPEN_KEY, this.chartOpen ? 'open' : 'closed');
        this.$nextTick(() => this.chartRefresh());
      },

      get axisPressed() {
        return this.$el.dataset.axis === this.axis ? 'true' : 'false';
      },
      get effectivePeriodMode() {
        return this.periodMode === 'auto' ? this.$root.dataset.defaultPeriod : this.periodMode;
      },
      get axisClass() {
        const mode = this.$el.dataset.period;
        return this.$el.dataset.axis === this.axis && (!mode || mode === this.effectivePeriodMode) ? 'is-current' : '';
      },
      get periodControlClass() {
        return this.axis === 'year' ? '' : 'is-hidden';
      },
      get scrollControlsClass() {
        return this.canScrollBack || this.canScrollForward ? '' : 'is-hidden';
      },
      get atScrollStart() {
        return !this.canScrollBack;
      },
      get atScrollEnd() {
        return !this.canScrollForward;
      },
      setPeriod(event) {
        const mode = event.target.value;
        if (!CHART_PERIODS.includes(mode)) return;
        this.periodMode = mode;
        viewStore(CHART_PERIOD_KEY, mode);
        this.$nextTick(() => this.chartRefresh());
      },
      updateChartScroll() {
        const scroll = this.$root.querySelector('.cite-chart__scroll.is-current');
        this.canScrollBack = Boolean(scroll && scroll.scrollLeft > 1);
        this.canScrollForward = Boolean(scroll && scroll.scrollWidth - scroll.clientWidth - scroll.scrollLeft > 1);
      },
      scrollChart(direction) {
        const scroll = this.$root.querySelector('.cite-chart__scroll.is-current');
        if (!scroll) return;
        scroll.scrollBy({ left: direction * Math.max(160, scroll.clientWidth * 0.8), behavior: scrollBehavior() });
      },
      scrollBackward() {
        this.scrollChart(-1);
      },
      scrollForward() {
        this.scrollChart(1);
      },
      setAxis() {
        this.axis = this.$el.dataset.axis;
        viewStore(CHART_AXIS_KEY, this.axis);
        this.$nextTick(() => this.chartRefresh());
      },

      narrowFromCell(event) {
        event.preventDefault();
      },

      init() {
        this.chartOpen = viewStored(CHART_OPEN_KEY) !== 'closed';
        const axis = viewStored(CHART_AXIS_KEY);
        if (CHART_AXES.includes(axis)) this.axis = axis;
        const period = viewStored(CHART_PERIOD_KEY);
        if (CHART_PERIODS.includes(period) && (period === 'auto' || this.$root.getAttribute(`data-period-${period}`) === 'true')) this.periodMode = period;
        this.listenNarrow();
        let frame = 0;
        let disposed = false;
        const refresh = () => {
          if (disposed || frame) return;
          frame = requestAnimationFrame(() => { frame = 0; this.updateChartScroll(); });
        };
        const root = this.$root;
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
        if (observer) observer.observe(root);
        root.addEventListener('scroll', refresh, true);
        window.addEventListener('resize', refresh);
        if (document.fonts) document.fonts.ready.then(refresh);
        this.chartRefresh = refresh;
        this.chartStop = () => {
          disposed = true;
          if (frame) cancelAnimationFrame(frame);
          if (observer) observer.disconnect();
          root.removeEventListener('scroll', refresh, true);
          window.removeEventListener('resize', refresh);
        };
        this.$nextTick(refresh);
      },
      destroy() {
        if (this.chartStop) this.chartStop();
      },
    })
  );

  Alpine.data('historyViews', () => ({
    historyView: 'courts',

    get historyViewPressed() {
      return this.$el.dataset.historyView === this.historyView ? 'true' : 'false';
    },
    get historyViewClass() {
      return this.$el.dataset.historyView === this.historyView ? 'is-current' : '';
    },
    setHistoryView() {
      this.historyView = this.$el.dataset.historyView;
      viewStore(HISTORY_VIEW_KEY, this.historyView);
      this.$nextTick(() => this.timelineLayout.refresh());
    },

    init() {
      const view = viewStored(HISTORY_VIEW_KEY);
      if (HISTORY_VIEWS.includes(view)) this.historyView = view;
      this.timelineLayout = observeHistoryTimeline(this.$root);
    },
    destroy() {
      if (this.timelineLayout) this.timelineLayout.stop();
    },
  }));
});
