const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function controller() {
  let factory;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/alpine/components/search_filter.js'), 'utf8'), {
    document: { addEventListener: (_, listener) => listener() },
    Alpine: { data: (_, value) => { factory = value; } },
    scrollBehavior: () => 'auto',
    URLSearchParams,
  });
  return factory();
}

test('pagination keeps endpoints, current page and bounded noninteractive gaps for every page', () => {
  const state = controller();
  for (let count = 1; count <= 100; count++) {
    state.pageCount = count;
    for (let page = 0; page < count; page++) {
      state.page = page;
      const items = state.pageItems;
      const pages = items.filter(item => item.isPage).map(item => item.page);
      assert.equal(pages[0], 0);
      assert.equal(pages.at(-1), count - 1);
      assert.ok(pages.includes(page));
      assert.ok(items.length <= 7);
      assert.equal(new Set(items.map(item => item.key)).size, items.length);
      assert.ok(items.filter(item => item.isGap).every(item => !item.isPage && item.page === undefined));
      assert.equal(state.atFirstPage, page === 0);
      assert.equal(state.atLastPage, page === count - 1);
    }
  }
});

test('page actions reject unavailable pages and retain existing URL synchronization', () => {
  const state = controller();
  state.pageCount = 10;
  const calls = [];
  state.recount = () => calls.push('recount');
  state.syncToURL = () => calls.push('url');
  state.$root = { querySelector: () => ({ scrollIntoView: () => calls.push('scroll') }) };
  [-1, 10, 1.5, NaN, 0].forEach(page => state.goToPage(page));
  assert.equal(calls.length, 0);
  state.goToPage(9);
  assert.equal(state.page, 9);
  assert.deepEqual(calls, ['recount', 'url', 'scroll']);
  state.nextPage();
  assert.equal(calls.length, 3);
  state.prevPage();
  assert.equal(state.page, 8);
});

test('filter count reflects individual selected conditions and omits a zero badge', () => {
  const state = controller();
  assert.equal(state.filterButtonLabel, 'Filters (1)');
  state.filterAnchorsOnly = false;
  assert.equal(state.filterButtonLabel, 'Filters');
  state.selectedCourts = ['ca1', 'ca2'];
  state.filterCrWarning = true;
  state.filterDhPositive = true;
  state.query = 'case';
  state.sortKey = 'name';
  assert.equal(state.filterButtonLabel, 'Filters (4)');
});

test('only the current numbered button receives aria-current', () => {
  const state = controller();
  state.page = 0;
  for (const [value, expected] of [['', null], ['0', 'page'], ['1', null]]) {
    state.$el = { dataset: { page: value } };
    assert.equal(state.pageCurrent, expected);
  }
});
