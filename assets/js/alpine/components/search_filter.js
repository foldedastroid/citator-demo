const PAGE_SIZE = 10;
const STORAGE_KEY = 'citatorSearchFilter';
const DH_FILTERS = ['filterDhStop', 'filterDhWarning', 'filterDhCaution', 'filterDhPositive', 'filterDhNeutral'];
const CR_FILTERS = ['filterCrStop', 'filterCrWarning', 'filterCrCaution', 'filterCrPositive', 'filterCrNeutral'];
const TIERS = ['stop', 'warning', 'caution', 'positive', 'neutral'];

let pickerOrigin = null;

function courtKeyOf(el) {
  const holder = el.closest('[data-court-key]');
  return holder ? holder.dataset.courtKey : '';
}

document.addEventListener('alpine:init', () => {
  Alpine.data('searchFilter', () => ({
    query: '',

    queryKey: '',
    selectedCourts: [],
    filterDhStop: false,
    filterDhWarning: false,
    filterDhCaution: false,
    filterDhPositive: false,
    filterDhNeutral: false,
    filterCrStop: false,
    filterCrWarning: false,
    filterCrCaution: false,
    filterCrPositive: false,
    filterCrNeutral: false,
    filterAnchorsOnly: true,

    sortKey: 'newest',
    totalCount: 0,
    visibleCount: 0,

    tierCounts: {},
    page: 0,
    pageCount: 1,


    layout: 0,
    pickerOpen: false,

    pickerTab: '',
    pickerQuery: '',

    courtNames: {},


    changed() {
      this.page = 0;
      this.syncToURL();
      this.recount();
    },


    normalize(value) {
      return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    },
    setQuery(event) {
      this.query = (event.target.value || '').trim().toLowerCase();
      this.queryKey = this.normalize(this.query);
      this.changed();
    },
    get filterChecked() {
      return this[this.$el.dataset.filter];
    },

    get filterOn() {
      return this[this.$el.dataset.filter] ? 'true' : 'false';
    },
    get filterClass() {
      return this[this.$el.dataset.filter] ? 'is-on' : '';
    },
    get filterCountLabel() {
      const holder = this.$el.closest('[data-filter]');
      const n = holder ? this.tierCounts[holder.dataset.filter] || 0 : 0;
      return `, ${n} opinion${n === 1 ? '' : 's'}`;
    },
    get filterCount() {
      const holder = this.$el.closest('[data-filter]');
      return holder ? String(this.tierCounts[holder.dataset.filter] || 0) : '';
    },
    toggleFilter() {
      const prop = this.$el.dataset.filter;
      this[prop] = !this[prop];
      this.changed();
    },
    setAnchorsOnly(event) {
      this.filterAnchorsOnly = event.target.checked;
      this.changed();
    },
    setSort(event) {
      this.sortKey = event.target.value;
      this.applySort();
      this.changed();
    },

    applySort() {
      const list = this.$root.querySelector('.home-list');
      if (!list) return;
      const rows = Array.from(list.querySelectorAll(':scope > li[data-court]'));
      const by = {
        newest: (a, b) => b.dataset.date.localeCompare(a.dataset.date),
        oldest: (a, b) => a.dataset.date.localeCompare(b.dataset.date),
        name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
        court: (a, b) =>
          Number(a.dataset.courtLevel) - Number(b.dataset.courtLevel) || b.dataset.date.localeCompare(a.dataset.date),
      }[this.sortKey] || null;
      if (!by) return;
      rows.sort(by).forEach((row) => list.append(row));
    },

    get noResults() {
      return this.visibleCount === 0;
    },
    clearAllFilters() {
      [...DH_FILTERS, ...CR_FILTERS].forEach((p) => {
        this[p] = false;
      });
      this.selectedCourts = [];
      this.query = '';
      this.queryKey = '';
      this.filterAnchorsOnly = false;
      this.changed();
    },
    get hasSeverityFilters() {
      return [...DH_FILTERS, ...CR_FILTERS].some((p) => this[p]);
    },
    clearSeverityFilters() {
      [...DH_FILTERS, ...CR_FILTERS].forEach((p) => {
        this[p] = false;
      });
      this.changed();
    },

    setCourts(keys) {
      this.selectedCourts = [...new Set(keys)];
      this.changed();
    },
    get courtSelected() {
      return this.selectedCourts.includes(courtKeyOf(this.$el));
    },
    toggleCourt(event) {
      const key = courtKeyOf(event.target);
      const rest = this.selectedCourts.filter((c) => c !== key);
      this.setCourts(event.target.checked ? [...rest, key] : rest);
    },
    removeCourt() {
      const key = courtKeyOf(this.$el);
      this.setCourts(this.selectedCourts.filter((c) => c !== key));
    },
    get hasSelectedCourts() {
      return this.selectedCourts.length > 0;
    },
    get courtSummary() {
      const n = this.selectedCourts.length;
      if (n === 0) return 'All courts';
      if (n === 1) return this.courtNames[this.selectedCourts[0]] || '1 court';
      return `${n} courts`;
    },
    courtKeysIn(scope) {
      return [...scope.querySelectorAll('[data-court-key]')].map((el) => el.dataset.courtKey);
    },
    checkAllCourts() {
      this.setCourts(this.courtKeysIn(this.$root));
    },
    clearAllCourts() {
      this.setCourts([]);
    },
    currentPanel() {
      return this.$root.querySelector(`[data-tab-key="${this.pickerTab}"]`);
    },
    checkTabCourts() {
      const panel = this.currentPanel();
      if (panel) this.setCourts([...this.selectedCourts, ...this.courtKeysIn(panel)]);
    },
    clearTabCourts() {
      const panel = this.currentPanel();
      if (!panel) return;
      const dropped = new Set(this.courtKeysIn(panel));
      this.setCourts(this.selectedCourts.filter((k) => !dropped.has(k)));
    },

    groupKeys(el) {
      return (el.dataset.courtKeys || '').split(',').filter(Boolean);
    },
    get groupAllSelected() {
      const keys = this.groupKeys(this.$el);
      return keys.length > 0 && keys.every((k) => this.selectedCourts.includes(k));
    },
    syncGroupBox() {
      const keys = this.groupKeys(this.$el);
      const some = keys.some((k) => this.selectedCourts.includes(k));
      this.$el.indeterminate = some && !keys.every((k) => this.selectedCourts.includes(k));
    },
    toggleGroup(event) {
      const keys = this.groupKeys(event.target);
      if (event.target.checked) {
        this.setCourts([...this.selectedCourts, ...keys]);
      } else {
        const dropped = new Set(keys);
        this.setCourts(this.selectedCourts.filter((k) => !dropped.has(k)));
      }
    },

    openPicker() {
      pickerOrigin = this.$el;
      this.pickerOpen = true;
      document.body.classList.add('is-modal-open');

      const field = this.$root.querySelector('.court-modal__dialog input[type="search"]');
      let tries = 0;
      const focusField = () => {
        if (!field || !this.pickerOpen) return;
        if (field.offsetParent !== null) field.focus();
        else if ((tries += 1) < 20) setTimeout(focusField, 25);
      };
      focusField();
    },
    closePicker() {
      if (!this.pickerOpen) return;
      this.pickerOpen = false;
      this.pickerQuery = '';
      document.body.classList.remove('is-modal-open');
      const origin = pickerOrigin;
      pickerOrigin = null;
      if (origin && origin.isConnected) this.$nextTick(() => origin.focus({ preventScroll: true }));
    },

    trapPicker(event) {
      if (event.key !== 'Tab') return;
      const dialog = this.$root.querySelector('.court-modal__dialog');
      const items = Array.from(dialog.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')).filter(
        (el) => el.offsetParent !== null && !el.disabled
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    selectPickerTab() {
      this.pickerTab = this.$el.dataset.tabKey;
    },
    get pickerTabSelected() {
      return this.pickerTab === this.$el.dataset.tabKey ? 'true' : 'false';
    },
    get pickerTabClass() {
      return this.pickerTab === this.$el.dataset.tabKey ? 'is-active' : '';
    },
    get pickerPanelVisible() {
      return this.pickerTab === this.$el.dataset.tabKey;
    },
    setPickerQuery(event) {
      this.pickerQuery = (event.target.value || '').trim().toLowerCase();
    },

    get courtVisible() {
      return !this.pickerQuery || (this.$el.dataset.courtName || '').includes(this.pickerQuery);
    },
    get groupVisible() {
      return !this.pickerQuery || (this.$el.dataset.courtNames || '').includes(this.pickerQuery);
    },
    get pickerTabEmpty() {
      if (!this.pickerQuery) return false;
      const panel = this.$el.closest('[data-tab-key]');
      if (!panel) return false;
      return ![...panel.querySelectorAll('[data-court-name]')].some((row) =>
        (row.dataset.courtName || '').includes(this.pickerQuery)
      );
    },


    tierHit(group, value) {
      return group.some((p, i) => this[p] && TIERS[i] === value);
    },
    baseMatches(el) {
      if (this.filterAnchorsOnly && el.dataset.tier !== 'anchor') return false;
      if (this.selectedCourts.length && !this.selectedCourts.includes(el.dataset.court)) return false;
      if (this.queryKey && !(el.dataset.search || '').includes(this.queryKey)) return false;
      return true;
    },
    rowMatches(el) {
      if (this.filterAnchorsOnly && el.dataset.tier !== 'anchor') return false;
      if (this.selectedCourts.length && !this.selectedCourts.includes(el.dataset.court)) return false;


      if (this.hasSeverityFilters) {
        const hit =
          this.tierHit(DH_FILTERS, el.dataset.dhSeverity) ||
          this.tierHit(CR_FILTERS, el.dataset.crSeverity);
        if (!hit) return false;
      }
      if (this.queryKey && !(el.dataset.search || '').includes(this.queryKey)) return false;
      return true;
    },


    get rowVisible() {
      void this.layout;
      if (!this.rowMatches(this.$el)) return false;
      const idx = parseInt(this.$el.dataset.pageIndex || '-1', 10);
      return idx >= this.page * PAGE_SIZE && idx < (this.page + 1) * PAGE_SIZE;
    },
    recount() {
      let count = 0;
      const counts = {};
      [...DH_FILTERS, ...CR_FILTERS].forEach((p) => {
        counts[p] = 0;
      });
      this.$root.querySelectorAll('[data-court]').forEach((row) => {
        if (this.baseMatches(row)) {
          const dh = TIERS.indexOf(row.dataset.dhSeverity);
          const cr = TIERS.indexOf(row.dataset.crSeverity);
          if (dh >= 0) counts[DH_FILTERS[dh]] += 1;
          if (cr >= 0) counts[CR_FILTERS[cr]] += 1;
        }
        if (this.rowMatches(row)) {
          row.dataset.pageIndex = String(count);
          count += 1;
        } else {
          row.dataset.pageIndex = '-1';
        }
      });
      this.visibleCount = count;
      this.tierCounts = counts;
      this.pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
      if (this.page > this.pageCount - 1) this.page = this.pageCount - 1;
      this.layout += 1;
    },

    get activeFilterCount() {
      return this.selectedCourts.length + [...DH_FILTERS, ...CR_FILTERS].filter((key) => this[key]).length + Number(this.filterAnchorsOnly);
    },
    get filterButtonLabel() {
      return this.activeFilterCount ? `Filters (${this.activeFilterCount})` : 'Filters';
    },
    get pageItems() {
      const last = this.pageCount - 1;
      const start = Math.max(1, Math.min(this.page - 1, last - 4));
      const end = Math.min(last - 1, Math.max(this.page + 1, 4));
      const pages = this.pageCount <= 7
        ? Array.from({ length: this.pageCount }, (_, i) => i)
        : [0, ...Array.from({ length: end - start + 1 }, (_, i) => start + i), last];
      const items = [];
      pages.forEach((page, i) => {
        if (i && page - pages[i - 1] > 1) items.push({ key: `gap-${page}`, isGap: true, isPage: false });
        items.push({ key: `page-${page}`, page, label: String(page + 1), ariaLabel: `Page ${page + 1}`, isPage: true, isGap: false });
      });
      return items;
    },
    get pageCurrent() {
      const value = this.$el.dataset.page;
      return value !== '' && Number(value) === this.page ? 'page' : null;
    },
    choosePage(event) {
      this.goToPage(Number(event.currentTarget.dataset.page));
    },
    get hasPages() {
      return this.pageCount > 1;
    },
    get atFirstPage() {
      return this.page === 0;
    },
    get atLastPage() {
      return this.page >= this.pageCount - 1;
    },
    get pageLabel() {
      if (!this.visibleCount) return 'No opinions match';
      const from = this.page * PAGE_SIZE + 1;
      const to = Math.min(this.visibleCount, (this.page + 1) * PAGE_SIZE);
      return `${from}–${to} of ${this.visibleCount}`;
    },
    goToPage(page) {
      if (!Number.isInteger(page) || page < 0 || page >= this.pageCount || page === this.page) return;
      this.page = page;
      this.recount();
      this.syncToURL();
      const list = this.$root.querySelector('[role="list"]');
      if (list) list.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    },
    nextPage() {
      if (!this.atLastPage) this.goToPage(this.page + 1);
    },
    prevPage() {
      if (!this.atFirstPage) this.goToPage(this.page - 1);
    },

    activeTiers(group) {
      return group.filter((p) => this[p]).map((p) => TIERS[group.indexOf(p)]);
    },
    setTiers(group, tiers) {
      group.forEach((p, i) => {
        this[p] = tiers.includes(TIERS[i]);
      });
    },
    parseFromURL() {
      const params = new URLSearchParams(window.location.search);


      if (!params.toString()) {
        try {
          const saved = sessionStorage.getItem(STORAGE_KEY);
          if (saved) new URLSearchParams(saved).forEach((v, k) => params.set(k, v));
        } catch {}
      }
      this.query = (params.get('q') || '').trim().toLowerCase();
      this.queryKey = this.normalize(this.query);

      const known = (key) => !Object.keys(this.courtNames).length || key in this.courtNames;
      const courts = params.get('courts');
      this.selectedCourts = courts ? courts.split(',').filter((key) => key && known(key)) : [];
      this.setTiers(DH_FILTERS, (params.get('dh_sev') || '').split(','));
      this.setTiers(CR_FILTERS, (params.get('cr_sev') || '').split(','));
      this.filterAnchorsOnly = params.get('anchors') !== '0';
      this.page = Math.max(0, (parseInt(params.get('page'), 10) || 1) - 1);
      this.sortKey = ['newest', 'oldest', 'name', 'court'].includes(params.get('sort')) ? params.get('sort') : 'newest';
      if (!window.location.search && params.toString()) {
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      }
    },
    syncToURL() {
      const params = new URLSearchParams();
      if (this.query) params.set('q', this.query);
      if (this.selectedCourts.length) params.set('courts', this.selectedCourts.join(','));
      const dh = this.activeTiers(DH_FILTERS);
      if (dh.length) params.set('dh_sev', dh.join(','));
      const cr = this.activeTiers(CR_FILTERS);
      if (cr.length) params.set('cr_sev', cr.join(','));
      if (!this.filterAnchorsOnly) params.set('anchors', '0');
      if (this.sortKey !== 'newest') params.set('sort', this.sortKey);
      if (this.page > 0) params.set('page', String(this.page + 1));
      const qs = params.toString();
      try {
        if (qs) sessionStorage.setItem(STORAGE_KEY, qs);
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      if (window.location.pathname + window.location.search !== url) {
        window.history.replaceState(null, '', url);
        window.dispatchEvent(new Event('citator:location'));
      }
    },

    init() {
      this.totalCount = this.$root.querySelectorAll('[data-court]').length;
      this.$root.querySelectorAll('li[data-court-key]').forEach((el) => {
        this.courtNames[el.dataset.courtKey] =
          el.querySelector('label')?.textContent.trim() || el.dataset.courtKey;
      });
      const firstTab = this.$root.querySelector('[role="tab"][data-tab-key]');
      if (firstTab) this.pickerTab = firstTab.dataset.tabKey;
      this.parseFromURL();
      this.applySort();
      this.recount();


      window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
          this.parseFromURL();
          this.applySort();
          this.recount();
        }
      });
    },
  }));
});
