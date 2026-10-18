
















const SEVERITY_FILTERS = ['filterStop', 'filterWarning', 'filterCaution', 'filterPositive', 'filterNeutral'];
const RECOGNIZED_FILTERS = ['filterRecStop', 'filterRecWarning', 'filterRecCaution', 'filterRecPositive', 'filterRecNeutral'];
const VALIDATION_FILTERS = ['filterAgree', 'filterUnverified', 'filterDisagree'];
const TIER_OF_FILTER = {
  filterStop: 'stop', filterWarning: 'warning', filterCaution: 'caution', filterPositive: 'positive', filterNeutral: 'neutral',
  filterRecStop: 'stop', filterRecWarning: 'warning', filterRecCaution: 'caution', filterRecPositive: 'positive',
  filterRecNeutral: 'neutral',
  filterAgree: 'agree', filterUnverified: 'unverified', filterDisagree: 'disagree',
};


const AUTHORITIES_SORT_KEYS = {
  severity: 'severityIndex',
  date: 'dateIndex',
  mentions: 'mentionsIndex',
  name: 'nameIndex',
  appearance: 'appearanceIndex',
  court: 'courtIndex',
};
const CITED_BY_SORT_KEYS = {
  severity: 'severityIndex',
  recency: 'recencyIndex',
  mentions: 'mentionsIndex',
  name: 'nameIndex',
  court: 'courtIndex',
};

function datePeriodMatches(data, period) {
  let year = null;
  if (data.date !== undefined) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.date || '');
    if (match) {
      const [y, month, day] = match.slice(1).map(Number);
      const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]) year = y;
    }
  } else if (/^\d{4}$/.test(data.year || '')) year = Number(data.year);
  if (period === 'undated') return year === null;
  if (year === null) return false;
  const range = /^(\d{4}):(\d{4})$/.exec(period);
  if (range) return Number(range[1]) <= year && year <= Number(range[2]);
  return /^\d{1,4}$/.test(period) && String(year).padStart(4, '0').startsWith(period);
}

function treatmentList(sortKeys) {
  const state = {
    sortKeys,
    sortKey: 'severity',


    queryKey: '',
    totalCount: 0,
    visibleCount: 0,

    narrowTier: '',

    narrowCourt: '',
    narrowYear: '',

    setQuery(event) {
      this.queryKey = (event.target.value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      this.recount();
    },


    get filterChecked() {
      return this[this.$el.dataset.filter];
    },
    toggleFilter() {
      const prop = this.$el.dataset.filter;
      this[prop] = !this[prop];
    },
    get hasFilters() {
      return this.narrowed || [...SEVERITY_FILTERS, ...RECOGNIZED_FILTERS, ...VALIDATION_FILTERS].some((p) => this[p]);
    },
    get narrowed() {
      return Boolean(this.narrowTier || this.narrowCourt || this.narrowYear);
    },
    get narrowLabel() {
      const parts = [];
      if (this.narrowTier) parts.push(this.narrowTier[0].toUpperCase() + this.narrowTier.slice(1));
      if (this.narrowCourt) parts.push(this.narrowCourt);

      if (this.narrowYear) parts.push(this.narrowYear === 'undated' ? 'Date not available' : this.narrowYear.includes(':') ? this.narrowYear.replace(':', '–') : this.narrowYear.length === 3 ? `${this.narrowYear}0s` : this.narrowYear);
      return parts.join(' · ');
    },
    get narrowClearLabel() {
      return `Remove the narrowing: ${this.narrowLabel}`;
    },
    clearNarrow() {
      this.narrowTier = '';
      this.narrowCourt = '';
      this.narrowYear = '';
      this.recount();
    },
    applyNarrow(link) {
      const next = { narrowTier: link.dataset.narrow, narrowCourt: link.dataset.narrowCourt, narrowYear: link.dataset.narrowYear };
      const facet = 'narrowFacet' in link.dataset;
      Object.keys(next).forEach((prop) => {
        if (!facet) this[prop] = next[prop] || '';
        else if (next[prop] !== undefined) this[prop] = this[prop] === next[prop] ? '' : next[prop];
      });
      this.recount();
    },
    get filterSummaryClass() {
      return this.hasFilters ? 'list-filter__on' : '';
    },
    clearFilters() {
      [...SEVERITY_FILTERS, ...RECOGNIZED_FILTERS, ...VALIDATION_FILTERS].forEach((p) => {
        this[p] = false;
      });
      this.clearNarrow();
    },


    active(group) {
      return group.filter((p) => this[p]);
    },
    matches(active, value) {
      return active.some((p) => TIER_OF_FILTER[p] === value);
    },





    rowVisible(el) {
      if (this.queryKey && !(el.dataset.search || '').includes(this.queryKey)) return false;
      if (this.narrowTier && el.dataset.severity !== this.narrowTier) return false;
      if (this.narrowCourt && el.dataset.courtLabel !== this.narrowCourt) return false;
      if (this.narrowYear && !datePeriodMatches(el.dataset, this.narrowYear)) return false;
      const applied = this.active(SEVERITY_FILTERS);
      const recognized = this.active(RECOGNIZED_FILTERS);
      if (applied.length || recognized.length) {
        const hit =
          this.matches(applied, el.dataset.appliedSeverity) ||
          this.matches(recognized, el.dataset.recSeverity || 'none');
        if (!hit) return false;
      }
      const validation = this.active(VALIDATION_FILTERS);
      return !validation.length || this.matches(validation, el.dataset.validation);
    },



    get rowClass() {
      return this.rowVisible(this.$el) ? '' : 'row-hidden';
    },


    setSort(event) {
      if (event.target.value in this.sortKeys) this.sortKey = event.target.value;
      this.markGroups();
    },
    get listClass() {
      return this.sortKey === 'court' ? 'is-sort-court' : '';
    },

    markGroups() {
      const rows = Array.from(this.$root.querySelectorAll('[data-row-id]'));
      rows.forEach((row) => row.removeAttribute('data-group-first'));
      if (this.sortKey !== 'court') return;
      const seen = new Set();
      rows
        .filter((row) => this.rowVisible(row))
        .sort((a, b) => parseInt(a.dataset.courtIndex || '0', 10) - parseInt(b.dataset.courtIndex || '0', 10))
        .forEach((row) => {
          const label = row.dataset.courtLabel || '';
          if (seen.has(label)) return;
          seen.add(label);
          row.setAttribute('data-group-first', '');
        });
    },


    get rowStyle() {
      return { order: parseInt(this.$el.dataset[this.sortKeys[this.sortKey]] || '0', 10) };
    },

    recount() {
      const rows = this.$root.querySelectorAll('[data-row-id]');
      this.visibleCount = Array.from(rows).filter((row) => this.rowVisible(row)).length;
      this.markGroups();
      const panel = this.$root.closest('[role="tabpanel"]');
      window.dispatchEvent(
        new CustomEvent('citator-narrow', {
          detail: { list: panel ? panel.dataset.tab : '', tier: this.narrowTier, court: this.narrowCourt, year: this.narrowYear },
        })
      );
    },

    init() {
      const rows = this.$root.querySelectorAll('[data-row-id]');
      this.totalCount = rows.length;
      this.visibleCount = rows.length;




      const list = this.$root.querySelector('[role="list"]');
      if (list && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver((entries) => {
          for (const e of entries) {
            if (e.contentRect.height > 0) {
              list.style.minHeight = `${e.contentRect.height}px`;
              observer.disconnect();
              return;
            }
          }
        });
        observer.observe(list);
      }
      [...SEVERITY_FILTERS, ...RECOGNIZED_FILTERS, ...VALIDATION_FILTERS].forEach((p) =>
        this.$watch(p, () => this.recount())
      );

      const panel = this.$root.closest('[role="tabpanel"]');
      document.addEventListener('click', (event) => {
        const link =
          event.target.closest && event.target.closest('a[data-narrow], a[data-narrow-court], a[data-narrow-year]');
        if (!link || !panel || link.getAttribute('href') !== `#${panel.dataset.tab}`) return;
        this.applyNarrow(link);
      });
    },
  };
  [...SEVERITY_FILTERS, ...RECOGNIZED_FILTERS, ...VALIDATION_FILTERS].forEach((p) => {
    state[p] = false;
  });
  return state;
}

document.addEventListener('alpine:init', () => {
  Alpine.data('authoritiesFilter', () => treatmentList(AUTHORITIES_SORT_KEYS));
  Alpine.data('citedByFilter', () => treatmentList(CITED_BY_SORT_KEYS));
});
